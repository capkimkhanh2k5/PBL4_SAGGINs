from datetime import datetime, timezone
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import math
import random
import os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../GenAI')))
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../Classes')))
from Classes.satellite import Satellite
from Classes.gs import Gs
from Classes.ss import Ss
from Classes.network import Network
from Classes.request import request, ServiceType
from GenAI.real_env import SagsEnv
from stats_manager import StatsManager
import json
from sb3_contrib import QRDQN
import asyncio
from queue import Queue
import threading
import copy

request_queue = Queue()

EARTH_RADIUS = 6371000  # mét

    
# collection = db["satellites"]  # dùng để cập nhật vị trí vệ tinh

network = None
env = None
model = None
stats_manager = None
ai_worker_started = False

def start_ai_worker():
    global ai_worker_started
    if ai_worker_started:
        print("[WARN] AI worker already started, skipping.")
        return
    ai_worker_started = True
    print("[INFO] Starting AI worker thread...")
    threading.Thread(target=ai_worker, args=(env, model), daemon=True).start()
    
def ai_worker(env, model):
    global stats_manager

    while True:
        req, fut = request_queue.get()  # blocks until new request
        obs, _ = env.reset(request=req)
        done = False
        if env.neighbor_ids[0] is None:  # no possible starting action
            done = True
            obs[-1] = -1  # mark as failed
        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, done, truncated, info = env.step(action)

        try:
            current_request = env.current_request
            dis_qos = current_request.dis_QoS if current_request.dis_QoS else {}
            
            # Result of Agent
            agent_success = obs[-1] == 1
            agent_result = {
                "success": agent_success,
                "path": current_request.path,
                "latency": current_request.latency_actual,
                "uplink": current_request.uplink_allocated,
                "downlink": current_request.downlink_allocated,
                "reliability": current_request.reliability_actual,
                "cpu": current_request.cpu_allocated,
                "power": current_request.power_allocated,
            }

            # Result of Dijkstra
            is_dijkstra_satisfied = len(current_request.dis_path) > 0;

            dijsktra_result = {
                "success": is_dijkstra_satisfied,
                "path": current_request.dis_path,
                "latency": dis_qos.get("latency", 0.0),
                "uplink": dis_qos.get("uplink", 0.0),
                "downlink": dis_qos.get("downlink", 0.0),
                "reliability": dis_qos.get("reliability", 0.0),
                "cpu": dis_qos.get("cpu", 0.0),
                "power": dis_qos.get("power", 0.0),
            }

            if stats_manager:
                stats_manager.record_request(
                    request_id = current_request.request_id,
                    agent_result = agent_result,
                    dijkstra_result = dijsktra_result
                    )
        except Exception as e:
            print(f"Error in ai_worker: {e}")


        allocated = {}
        allocated["uplink"] = env.current_request.uplink_allocated
        allocated["downlink"] = env.current_request.downlink_allocated
        allocated["cpu"] = env.current_request.cpu_allocated
        allocated["power"] = env.current_request.power_allocated
        allocated["reliability"] = env.current_request.reliability_actual
        allocated["latency"] = env.current_request.latency_actual
        fut.set_result({
            "path": env.node_passed_ids,
            "result": "success" if obs[-1] == 1 else "failed",
            "id": req.request_id,
            "allocated": allocated
        })
        request_queue.task_done()

async def lifespan(app: FastAPI):
    global network, env, model, stats_manager
    print("[INFO] App startup — initializing environment...")
    network = Network()
    env = SagsEnv()
    stats_manager = StatsManager()

    #edit AI here!
    model = QRDQN.load("GenAI/qrdqn_model", env=env, device="auto")
    model.load_replay_buffer("GenAI/qrdqn_buffer")

    start_ai_worker()

    # Yield control back to FastAPI (this keeps the app running)
    yield

    # Shutdown phase (runs when app stops)
    print("[INFO] App shutdown — cleaning up...")
    
app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or restrict to ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/get_aggregate_stats")
async def get_aggregate_stats():
    """ API lấy dữ liệu thống kê tổng hợp """
    global stats_manager
    if stats_manager:
        stats = stats_manager.get_aggregate_stats()
        return stats
    return {"Error": "Stats manager not initialized"}

@app.get("/get_time_series_stats")
async def get_time_series_stats():
    """ API lấy dữ liệu theo thời gian """
    global stats_manager
    if stats_manager:
        return stats_manager.get_time_series_stats()
    return []

@app.get("/scan")
def scan(lat: float, lon: float, support5G : bool = False):
    visible = network.find_connectable_nodes_for_location(lat, lon, support5G=support5G)
    return_data = []
    for node in visible:
        mode = ""
        if node.typename == "groundstation" or node.typename == "seastation":
            mode = "surface"
        else:
            mode = "3d"
        return_data.append({
            "type": node.typename,
            "id": node.id,
            "distance": node.calculate_distance(lat, lon, mode = mode)/1000,
            "priority": node.priority
        })

    return_data.sort(key=lambda x: (x["priority"], x["distance"]))
    return visible

@app.get("/nodes")
def get_all_nodes():
    satellites = []
    ground_stations = []
    sea_stations = []
    for node in network.nodes.values():
        if node.typename == "satellite":
            satellites.append(node)
        elif node.typename == "groundstation":
            ground_stations.append(node)
        elif node.typename == "seastation":
            sea_stations.append(node)
    return {
        "satellites": [{"id": sat.id, "lat": sat.position["lat"], "lon": sat.position["lon"], "alt": sat.position["alt"]} for sat in satellites],
        "groundstations": [{"id": gs.id, "lat": gs.position["lat"], "lon": gs.position["lon"], "alt": gs.position["alt"]} for gs in ground_stations],
        "seastations": [{"id": ss.id, "lat": ss.position["lat"], "lon": ss.position["lon"], "alt": ss.position["alt"]} for ss in sea_stations],
    }

@app.get("/allnodes")
def get_all_nodes_detailed():
    all_nodes = []
    for node in network.nodes.values():
        #update satellite position if it's a satellite
        if node.typename == "satellite":
            node.update_satellite_position_obj_db()
        node_info = {
            "id": node.id,
            "type": node.typename,
            "position": node.position
        }
        if node.typename == "satellite":
            node_info.update({
                "sat_type": node.type,
                "orbit": node.orbit,
                "orbit_state": {"last_theta": node.last_theta},
            })
        node_info["position"]["alt"] = min(node_info["position"]["alt"], 3000000)  # Giới hạn độ cao tối đa để tránh giá trị quá lớn
        all_nodes.append(node_info)
    return all_nodes

@app.post("/handlereq")
async def handle_request(data: dict):
    type_index = data.get("type", 3)
    type = ServiceType(type_index) if type_index in [e.value for e in ServiceType] else ServiceType.DATA
    # Build Request object
    req = request(
        request_id=data.get("id", f"req_{random.randint(100000, 999999)}"),
        type=type,
        source_location={
            "lat": data.get("lat", 0),
            "lon": data.get("lon", 0),
            "alt": data.get("alt", 0)
        },
        uplink_required=data.get("uplink", 1),
        downlink_required=data.get("downlink", 1),
        latency_required=data.get("latency", 200),
        reliability_required=data.get("reliability", 0.95),
        cpu_required=data.get("cpu", 10),
        power_required=data.get("power", 10),
        packet_size=data.get("packet_size", 1),
        priority=data.get("priority", 5),
        demand_timeout=data.get("demand_timeout", 300),
        direct_sat_support=data.get("support5G", True),
        allow_partial=True  # you can also make this configurable if needed
    )
    # Put request into queue and wait for result
    fut = asyncio.get_running_loop().create_future()
    request_queue.put((req, fut))
    result = await fut  # await until worker finishes this one
    return result

@app.get("/getenvresources")
def get_env_resources():
    global env

    return env.get_snapshot()
    
    

    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("pythonService:app", host="0.0.0.0", port=8000, reload=True)