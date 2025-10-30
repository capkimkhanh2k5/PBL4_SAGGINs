import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../Classes')))
from Classes.network import Network
from Classes.request import ServiceType, request
from Classes.node import node
import math
from config import *
import heapq

#calculate cost djikstra from node u to node v
def calculate_cost(req: request, node_u: node, node_v: node):
    if req.type == ServiceType.EMERGENCY:
        MAX_USAGE = 0.95
    else:
        MAX_USAGE = 0.9

    MIN_QOS_COST = 0.5 #QoS min valid

    free_uplink = max(node_v.resources["uplink"] * MAX_USAGE - node_v.resources_used["uplink"], 0)
    free_downlink = max(node_v.resources["downlink"] * MAX_USAGE - node_v.resources_used["downlink"], 0)
    
    if free_uplink < req.uplink_required * MIN_QOS_COST or free_downlink < req.downlink_required * MIN_QOS_COST:
        return math.inf # Không đủ tài nguyên tính toán
    
    if node_v.typename == "groundstation":
        free_cpu = max(node_v.resources["cpu"] * MAX_USAGE - node_v.resources_used["cpu"], 0)
        free_power = max(node_v.resources["power"] * MAX_USAGE - node_v.resources_used["power"], 0)

        if free_cpu < req.cpu_required * MIN_QOS_COST or free_power < req.power_required * MIN_QOS_COST:
            return math.inf  # Không đủ tài nguyên tính toán
        
    if node_u is None:
        loc_u = req.source_location
        type_u = "user"
    else:
        loc_u = node_u.position
        type_u = node_u.typename

        if type_u == "satellite":
            type_u = node_u.type
    
    type_v = node_v.typename
    if type_v == "satellite":
        type_v = node_v.type
    
    distance = node_v.calculate_distance(loc_u["lat"], loc_u["lon"], loc_u.get("alt", 0)) / 1e7

    return distance

# method Dijsktra
def run_dijkstra(req: request, net: Network):
    if req.type == ServiceType.EMERGENCY:
        MAX_USAGE = 0.95
    else:
        MAX_USAGE = 0.9

    #reset dis_path and dis_QoS
    req.dis_path = []
    req.dis_QoS = {}

    distances = {node_id: math.inf for node_id in net.nodes}
    previous_nodes = {node_id: None for node_id in net.nodes}

    path_latency = {node_id: math.inf for node_id in net.nodes}
    path_reliability = {node_id: 0.0 for node_id in net.nodes}
    path_upLink = {node_id: math.inf for node_id in net.nodes}
    path_downLink = {node_id: math.inf for node_id in net.nodes}

    pq = [] # HEAP (cost, node_id)
    visited = set()

    #find start nodes can connect from source location
    start_nodes = net.find_connectable_nodes_for_location(
        req.source_location["lat"],
        req.source_location["lon"],
        req.source_location.get("alt", 0)
    )

    if not start_nodes:
        return  # No connectable nodes from source location
    
    #add nodes into Heap
    for start_node in start_nodes:
        cost = calculate_cost(req, None, start_node)

        if cost != math.inf:
            distances[start_node.id] = cost
            previous_nodes[start_node.id] = "SOURCE_USER"

            loc_u = req.source_location
            type_u = "user"
            type_v = start_node.typename
            if type_v == "satellite":
                type_v = start_node.type
            distance = start_node.calculate_distance(loc_u["lat"], loc_u["lon"], loc_u.get("alt", 0))

            path_latency[start_node.id] = calc_link_delay_ms(distance, type_u, type_v, req.type)
            path_reliability[start_node.id] = link_reliability(type_u, type_v, distance)

            free_uplink = max(start_node.resources["uplink"] * MAX_USAGE - start_node.resources_used["uplink"], 0)
            free_downlink = max(start_node.resources["downlink"] * MAX_USAGE - start_node.resources_used["downlink"], 0)

            path_upLink[start_node.id] = min(free_uplink, req.uplink_required)
            path_downLink[start_node.id] = min(free_downlink, req.downlink_required)

            heapq.heappush(pq, (cost, start_node.id))

    best_gs_id = None
    min_cost_to_gs = math.inf

    #loop dijkstra
    while pq:
        current_cost, current_node_id = heapq.heappop(pq)

        if current_node_id in visited:
            continue
        visited.add(current_node_id)

        current_node = net.get_node_by_id(current_node_id)

        if current_node is None:
            continue

        if current_node.typename == "groundstation":
            if current_cost < min_cost_to_gs:
                min_cost_to_gs = current_cost
                best_gs_id = current_node_id
        
        if current_cost > min_cost_to_gs:
            continue

        neighbors = net.find_connectable_nodes(current_node_id)
        for neighbor in neighbors:
            if neighbor.id in visited:
                continue

            #calculate cost
            cost = calculate_cost(req, current_node, neighbor)
            if cost == math.inf:
                continue

            new_cost = current_cost + cost
            
            if new_cost < distances[neighbor.id]:
                distances[neighbor.id] = new_cost
                previous_nodes[neighbor.id] = current_node_id

                #update QOS
                loc_u = current_node.position
                type_u = current_node.typename
                if type_u == "satellite":
                    type_u = current_node.type
                type_v = neighbor.typename
                if type_v == "satellite":
                    type_v = neighbor.type

                dis = neighbor.calculate_distance(loc_u["lat"], loc_u["lon"], loc_u.get("alt", 0))

                link_lat = calc_link_delay_ms(dis, type_u, type_v, req.type)
                link_rel = link_reliability(type_u, type_v, dis)

                path_latency[neighbor.id] = path_latency[current_node_id] + link_lat
                path_reliability[neighbor.id] = path_reliability[current_node_id] * link_rel

                free_uplink_used = max(neighbor.resources["uplink"] * MAX_USAGE - neighbor.resources_used["uplink"], 0)
                free_downlink_used = max(neighbor.resources["downlink"] * MAX_USAGE - neighbor.resources_used["downlink"], 0)

                path_upLink[neighbor.id] = min(path_upLink[current_node_id], free_uplink_used)
                path_downLink[neighbor.id] = min(path_downLink[current_node_id], free_downlink_used)

                heapq.heappush(pq, (new_cost, neighbor.id))

    #Reconstruct path to best gs
    if best_gs_id is not None:
        path = []
        curr_node_id = best_gs_id

        while curr_node_id is not None and curr_node_id != "SOURCE_USER":
            path.append(curr_node_id)
            curr_node_id = previous_nodes.get(curr_node_id)

        req.dis_path = list(reversed(path))

        gs_node = net.get_node_by_id(best_gs_id)
        gs_free_cpu = 0
        gs_free_power = 0
        if gs_node and gs_node.typename == "groundstation":
            gs_free_cpu = min(max(gs_node.resources["cpu"] * MAX_USAGE - gs_node.resources_used["cpu"], 0), req.cpu_required)
            gs_free_power = min(max(gs_node.resources["power"] * MAX_USAGE - gs_node.resources_used["power"], 0), req.power_required)
        
        req.dis_QoS = {
            "latency": path_latency[best_gs_id],
            "reliability": path_reliability[best_gs_id],
            "uplink": path_upLink[best_gs_id],
            "downlink": path_downLink[best_gs_id],
            "cpu": gs_free_cpu,
            "power": gs_free_power,

            "hops": len(req.dis_path),
        }