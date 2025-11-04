from datetime import datetime
import logging
import gymnasium as gym
from gymnasium import spaces
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../Classes')))
from satellite import Satellite
from gs import Gs
from ss import Ss
from network import Network
from request import ServiceType, request
from GroundSpace import GroundSpace
from node import node
from enum import Enum, auto
import math
import random
from config import *

#rel_link = exp(-gamma * (d_km))

class SagsEnv(gym.Env):
    def __init__(self):
        super().__init__()
        self.MAX_STEP = MAX_STEP
        self.path_log_file = f"paths_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        self.step_log_file = f"steps_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        self.release_log_file = f"release_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        # with open(self.path_log_file, "w") as f:
        #     f.write("=== SAGs Environment Path Log ===\n\n")
        # with open(self.step_log_file, "w") as f:
        #     f.write("=== SAGs Environment Step Log ===\n\n")
        # with open(self.release_log_file, "w") as f:
        #     f.write("=== SAGs Environment Resource Release Log ===\n\n")

        # Internal world state (hidden from agent)
        self.network = Network()
        self.num_nodes = len(self.network.nodes)
        self.connections = []  #List of all Requests currently being served and later we will release resource to keep the environemnt run endlessly
        self.groundspace = GroundSpace() #Store location of each request to quickly scan for nearby users
        self.obs_dim = 169
        self.observation_space = spaces.Box(
            low=0, high=1.0, 
            shape=(self.obs_dim,)
            , dtype=np.float32
        )
        self.count = 0
        self.action_space = spaces.Discrete(10)


        self.steps = 0
        self.current_request = None #Store the current request
        self.neighbor_ids = [None]*10 #Store the id of 10 nearest not passed nodes
        self.current_node : node = None #Store the current node
        self.node_passed_ids = [] #Store the id of nodes passed to quickly check if a node has been passed
        
        self.waiting_queue = [] #Store requests waiting for resource
        
        #Để rollBack
        # self.alloc_ledger = {} # {req_id: [("relay", node, up_used, dn_used), ("gs", node, cpu_used, power_used), ...]}
        self._log_reward = 0
        self._log_score = 0
        self.isvalid_action = True
        # self.total_episodes = 0
    
    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        
        if self.current_node == None or self.current_request == None:
            #Initialize environemnt
            self.network = Network()
            self.groundspace = GroundSpace()
            self.connections = []
            self.steps = 0
            self.neighbor_ids = [None]*10
            self.current_node = None
            self.node_passed_ids = []
        #Check for timeout of each request in connections
        timeout_req = []
        for index, request in enumerate(self.connections):
            request.real_timeout -= 1
            if request.real_timeout <= 0:
                timeout_req.append(index)
        for index in timeout_req:
            req = self.connections.pop(index)
            self.groundspace.remove_request(req)
            for id in req.path:
                node = self.network.get_node_by_id(id)
                if node:
                    node.release_resource(req)
                    # self.log_remove(node, req)
        self.current_node = None
        self.node_passed_ids = []
        self.current_request = None
        self.neighbor_ids = [None]*10
        self._log_reward = 0
        self.steps = 0
        self._log_score = 0
        self._new_request()
        obs = self._get_obs()
        return obs, {}
    
    #Tạo request
    def _new_request(self):
        """Spawn a new client request"""
        client_location = random_user()
        while (not self.network.check_neighbor_exist(
            client_location["lat"],
            client_location["lon"],
            client_location["alt"]
        )):
            client_location = random_user()
        service_type = random.choice(list(ServiceType))
        QoSProfiles_service = QoSProfiles[service_type]
        uplink_required = round(random.uniform(*QoSProfiles_service["uplink"]), 2)
        downlink_required = round(random.uniform(*QoSProfiles_service["downlink"]), 2)
        latency_required = round(random.uniform(*QoSProfiles_service["latency"]), 2)
        reliability_required = round(random.uniform(*QoSProfiles_service["reliability"]), 4)
        cpu_required = random.randint(*QoSProfiles_service["cpu"])
        power_required = random.randint(*QoSProfiles_service["power"])
        packet_size = random.randint(1, 100)  # MB
        demand_timeout = random.randint(100, 4000)  # episode
        priority = random.randint(*QoSProfiles_service["priority"])
        new_request = request(
            request_id=self.count,
            type=service_type,
            source_location=client_location,
            uplink_required=uplink_required,
            downlink_required=downlink_required,
            latency_required=latency_required,
            reliability_required=reliability_required,
            cpu_required=cpu_required,
            power_required=power_required,
            packet_size=packet_size,
            priority=priority,
            demand_timeout=demand_timeout
        )
        self.current_request = new_request


    # Mã hóa trạng thái môi trường cho Agent học
    def _get_obs(self):
        """Return request-local state vector"""
        Maximum_resource_usage = 0.9 #Maximum resource usage percentage of a node, to avoid overloading
        if self.current_request.type == ServiceType.EMERGENCY:
            Maximum_resource_usage = 0.95
        obs = np.zeros(self.obs_dim, dtype=np.float32)
        service_index = self.current_request.type.value - 1
        obs[service_index] = 1.0  # One-hot encoding of service type
        obs[8] = min(self.steps / MAX_STEP, 1.0)  # Current hop / Max hops
        obs[9] = min(self.current_request.uplink_required / 20.0, 1.0)  # Uplink required / max uplink
        obs[10] = min((self.current_request.uplink_allocated / self.current_request.uplink_required
                if self.current_request.uplink_required > 0 else 0.0), 1.0)  # Uplink allocated / uplink required
        obs[11] = min(self.current_request.downlink_required / 100.0, 1.0)  # Downlink required / max downlink
        obs[12] = min((self.current_request.downlink_allocated / self.current_request.downlink_required
                if self.current_request.downlink_required > 0 else 0.0), 1.0)  # Downlink allocated / downlink required
        if not self.current_node:
            current_lat = self.current_request.source_location["lat"]
            current_lon = self.current_request.source_location["lon"]
            current_alt = self.current_request.source_location["alt"]
        else:
            current_lat = self.current_node.position["lat"]
            current_lon = self.current_node.position["lon"]
            current_alt = self.current_node.position["alt"]
        lat_rad = math.radians(current_lat)
        lon_rad = math.radians(current_lon)
        obs[13] = (math.sin(lat_rad) + 1) / 2.0  # Normalized sin(lat)
        obs[14] = (math.cos(lat_rad) + 1) / 2.0  # Normalized cos(lat)
        obs[15] = (math.sin(lon_rad) + 1) / 2.0  # Normalized sin(lon)
        obs[16] = (math.cos(lon_rad) + 1) / 2.0  # Normalized cos(lon)
        obs[17] = min(current_alt / 1e6, 1.0)  # Normalized altitude
        obs[18] = min(self.current_request.reliability_required / 1.0, 1.0)  # Reliability required / max reliability
        obs[19] = min((self.current_request.reliability_actual / self.current_request.reliability_required
                if self.current_request.reliability_required > 0 else 0.0), 1.0)  # Current reliability / reliability required
        obs[20] = min(self.current_request.latency_required / 500.0, 1.0)  # Required latency / max latency
        obs[21] = min((self.current_request.latency_required / self.current_request.latency_actual
                if self.current_request.latency_actual > 0 else 1.0), 1.0)  # Latency required / latency currently
        #Lưu ý: Up/down + relibiliaty Càng cao càng tốt nhưng latency thì ngược lại
        # số hop càng ít càng tốt
        obs[22] = min(self.current_request.priority / 10.0, 1.0)  # Priority / max priority
        obs[23] = min(self.current_request.cpu_required / 50.0, 1.0)  # CPU required / max cpu
        obs[24] = min(self.current_request.power_required / 100.0, 1.0)  # Power required / max power
        connectable_nodes = []
        if self.current_node:
            connectable_nodes = self.network.find_connectable_nodes(self.current_node.id)
        else:
            connectable_nodes = self.network.find_connectable_nodes_for_location(
                self.current_request.source_location["lat"],
                self.current_request.source_location["lon"],
                self.current_request.source_location["alt"]
            )
        obs[25] = min(len(connectable_nodes) / 10.0, 1.0)  # Number of connectable nodes / 10
        self.neighbor_ids = [None]*10
        count = 0
        for node in connectable_nodes:
            uplink_rate = (node.resources_used["uplink"] / node.resources["uplink"])
            downlink_rate = (node.resources_used["downlink"] / node.resources["downlink"])
            cpu_rate = (node.resources_used["cpu"] / node.resources["cpu"])
            power_rate = (node.resources_used["power"] / node.resources["power"])
            if node.id not in self.node_passed_ids and uplink_rate < Maximum_resource_usage and downlink_rate < Maximum_resource_usage and cpu_rate < Maximum_resource_usage and power_rate < Maximum_resource_usage:
                self.neighbor_ids[count] = node.id
                count += 1
            if count >= 10:
                break
        users_in_range_count = self.groundspace.nearby_count(
            self.current_request.source_location["lat"],
            self.current_request.source_location["lon"],
            2500
        )
        obs[26] = min(users_in_range_count / 10000.0, 1.0)  # Number of users in range of 2500km / 10000
        obs[27] = min(self.current_request.real_timeout / self.current_request.demand_timeout
                if self.current_request.demand_timeout > 0 else 0.0, 1.0)  # Timeout remaining / estimated timeout
        # Top 10 nearest nodes info
        def process_neighbor(i, self, count):
            if i >= count:
                return i, None, [0.0]*13  # pad with zeros

            current_location = self.current_node.position if self.current_node else self.current_request.source_location
            node = self.network.get_node_by_id(self.neighbor_ids[i])
            
            # Distance
            distance = node.calculate_distance(
                current_location["lat"],
                current_location["lon"],
                current_location["alt"]
            )
            obs_chunk = [0.0]*13
            obs_chunk[0] = min(distance / 1e7, 1.0)
            
            # Node types
            current_node_type = self.current_node.typename if self.current_node else "user"
            if current_node_type == "satellite":
                current_node_type = self.current_node.type
            node_type = node.typename
            if node_type == "satellite":
                node_type = node.type
            
            # Link delay
            link_delay = calc_link_delay_ms(distance, current_node_type, node_type, self.current_request.type)
            obs_chunk[1] = min(link_delay / 500.0, 1.0)
            
            # Link reliability
            link_reliab = link_reliability(current_node_type, node_type, distance)
            obs_chunk[2] = min(link_reliab / 1.0, 1.0)
            
            # Uplink / downlink
            uplink_available = max(node.resources["uplink"]*Maximum_resource_usage - node.resources_used["uplink"], 0)
            obs_chunk[3] = min(uplink_available / self.current_request.uplink_allocated
                            if self.current_request.uplink_allocated > 0 else 1.0, 1.0)
            downlink_available = max(node.resources["downlink"]*Maximum_resource_usage - node.resources_used["downlink"], 0)
            obs_chunk[4] = min(downlink_available / self.current_request.downlink_allocated
                            if self.current_request.downlink_allocated > 0 else 1.0, 1.0)
            
            # CPU / Power
            if node.typename != "groundstation":
                obs_chunk[5] = 1.0
                obs_chunk[6] = 1.0
            else:
                cpu_available = max(node.resources["cpu"]*Maximum_resource_usage - node.resources_used["cpu"], 0)
                obs_chunk[5] = min(cpu_available / self.current_request.cpu_required
                                if self.current_request.cpu_required > 0 else 1.0, 1.0)
                power_available = max(node.resources["power"]*Maximum_resource_usage - node.resources_used["power"], 0)
                obs_chunk[6] = min(power_available / self.current_request.power_required
                                if self.current_request.power_required > 0 else 1.0, 1.0)
            
            # Groundstation check
            obs_chunk[7] = 1.0 if node.typename == "groundstation" else 0.0
            
            # Estimate timeout
            estimate_timeout = max_timeout = self.current_request.real_timeout
            if self.current_node:
                if self.current_node.typename == "satellite" and node.typename == "satellite":
                    current_sat = self.network.get_satellite_by_id(self.current_node.id)
                    target_sat = self.network.get_satellite_by_id(node.id)
                    if current_sat and target_sat:
                        estimate_timeout = current_sat.estimate_visible_time_sat(target_sat, max_time=max_timeout)
                elif self.current_node.typename == "satellite":
                    current_sat = self.network.get_satellite_by_id(self.current_node.id)
                    if current_sat:
                        estimate_timeout = current_sat.estimate_visible_time(node.position["lat"], node.position["lon"], node.position["alt"], max_time=max_timeout)
            obs_chunk[8] = min(estimate_timeout / self.current_request.real_timeout
                            if self.current_request.real_timeout > 0 else 1.0, 1.0)
            
            # Users in range
            users_in_range_count = self.groundspace.nearby_count(node.position["lat"], node.position["lon"], 2500)
            obs_chunk[9] = min(users_in_range_count / 10000.0, 1.0)
            
            # Distance to nearest GS
            gs_distance, gs_id = self.network.distance_to_nearest_gs(node.position["lat"], node.position["lon"], node.position["alt"])
            obs_chunk[10] = min(gs_distance/4e6, 1.0) if gs_distance is not None else 1.0
            
            # Remark of nearest GS
            if gs_id is not None:
                gs = self.network.get_gs_by_id(gs_id)
                initial_mark = 0
                gs_uplink_available = max(gs.resources["uplink"]*Maximum_resource_usage - gs.resources_used["uplink"], 0)
                rate_uplink = gs_uplink_available / (self.current_request.uplink_allocated if self.current_request.uplink_allocated > 0 else self.current_request.uplink_required)
                initial_mark += int(rate_uplink * 2.5)
                gs_downlink_available = max(gs.resources["downlink"]*Maximum_resource_usage - gs.resources_used["downlink"], 0)
                rate_downlink = gs_downlink_available / (self.current_request.downlink_allocated if self.current_request.downlink_allocated > 0 else self.current_request.downlink_required)
                initial_mark += int(rate_downlink * 2.5)
                gs_cpu_available = max(gs.resources["cpu"]*Maximum_resource_usage - gs.resources_used["cpu"], 0)
                rate_cpu = gs_cpu_available / (self.current_request.cpu_required if self.current_request.cpu_required > 0 else 1)
                initial_mark += int(rate_cpu * 2.5)
                gs_power_available = max(gs.resources["power"]*Maximum_resource_usage - gs.resources_used["power"], 0)
                rate_power = gs_power_available / (self.current_request.power_required if self.current_request.power_required > 0 else 1)
                initial_mark += int(rate_power * 2.5)
                usage = gs.get_mean_usage()
                if usage >= 0.6:
                    initial_mark -= int((usage - 0.6) / 0.4 * 4)
                obs_chunk[11] = min(initial_mark / 10.0, 1.0)
            else:
                obs_chunk[11] = 0.0
            
            # Node mean usage
            obs_chunk[12] = min(node.get_mean_usage(), 1.0)
            
            return i, node.id, obs_chunk 
        with ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(lambda i: process_neighbor(i, self, count), range(10)))

        # Fill obs and neighbor_ids
        for i, node_id, obs_chunk in results:
            obs[28 + i*13 : 28 + (i+1)*13] = obs_chunk
            
        #10 bit for neighbor mask
        for j in range(10):
            if self.neighbor_ids[j] is not None:
                obs[158+j] = 1.0
            else:
                obs[158+j] = 0.0
        obs[168] = 0
        if self.current_node:
            obs[168] = 1.0 if self.current_node.typename == "groundstation" else 0.0  # GS or not
        if self.isvalid_action == False:
            obs[168] = 0.5  # Invalid action last step
        return obs
    
    
    #Tính reward
    def calculate_efficent_usage_bonus(self):
        usage = self.current_node.get_mean_usage() if self.current_node else 0
        if usage < 0.6:
            return usage_pool
        else:
            return usage_pool*(1-usage)/(1-0.6)
        
    def calculate_hop_reward(self):
        return HOP_PENALTY - (self.steps ** 2) * 0.35

    
    def calculate_base_reward(self):
        return BASE_REWARD * (1 - self.steps / MAX_STEP)
    
    def _calculate_reward(self, obs):
        MAXIMUM_RESOURCE_USAGE = 0.9 #Maximum resource usage percentage of a node, to avoid overloading
        if self.current_request.type == ServiceType.EMERGENCY:
            MAXIMUM_RESOURCE_USAGE = 0.95
        check = False
        reward = 0.0
        reward += self.calculate_base_reward()
        reward += self.calculate_efficent_usage_bonus()
        reward += self.calculate_hop_reward()
        #Calculate timeout reward
        timeout_ratio = obs[27]  # Timeout remaining / estimated timeout
        reward += timeout_pool * timeout_ratio
        #Calculate QOS reward
        #get weights
        weights = BonusProfilesForService.get(self.current_request.type, (0.25, 0.25, 0.25, 0.25))
        w_lat, w_rel, w_up, w_down = weights
        #Latency
        lat_ratio = obs[21]  # Latency required / latency currently
        reward += QOS_pool * w_lat * (lat_ratio**1.5)
        #Reliability
        rel_ratio = obs[19]  # Current reliability / reliability required
        reward += QOS_pool * w_rel * (rel_ratio**1.5)
        #Uplink
        up_ratio = obs[10]  # Uplink allocated / uplink required
        reward += QOS_pool * w_up * up_ratio
        #Downlink
        down_ratio = obs[12]  # Downlink allocated / downlink required
        reward += QOS_pool * w_down * down_ratio
        
        #Bonus when come near a gs , these information is in the obs[38 + i * 13] and obs[39 + i * 13]
        if self.current_node:
            current_lat = self.current_node.position["lat"]
            current_lon = self.current_node.position["lon"]
            current_alt = self.current_node.position["alt"]
        else:
            current_lat = self.current_request.source_location["lat"]
            current_lon = self.current_request.source_location["lon"]
            current_alt = self.current_request.source_location["alt"]
        gs_distance, gs_id = self.network.distance_to_nearest_gs(
            current_lat,
            current_lon,
            current_alt
        )
        distance_rate = gs_distance / 4e6 if gs_distance is not None else 1.0  # Distance to nearest GS
        distance_rate = min(distance_rate, 1.0)
        reward += GS_proximity_bonus * (1 - distance_rate) * 3/4
        #Remark of nearest GS
        score = 0
        if gs_id is not None:
            gs = self.network.get_gs_by_id(gs_id)
            if gs:
                initial_mark = 0
                #Rate by uplink, downlink, cpu, power compared to the current allocated and required
                gs_uplink_available = max(gs.resources["uplink"]*MAXIMUM_RESOURCE_USAGE - gs.resources_used["uplink"], 0)
                rate_uplink = gs_uplink_available / (self.current_request.uplink_allocated
                                    if self.current_request.uplink_allocated > 0 else self.current_request.uplink_required)
                initial_mark += int(rate_uplink * 2.5)  # Up to 2.5
                gs_downlink_available = max(gs.resources["downlink"]*MAXIMUM_RESOURCE_USAGE - gs.resources_used["downlink"], 0)
                rate_downlink = gs_downlink_available / (self.current_request.downlink_allocated
                                    if self.current_request.downlink_allocated > MAXIMUM_RESOURCE_USAGE else self.current_request.downlink_required)
                initial_mark += int(rate_downlink * 2.5)  # Up to 2.5
                gs_cpu_available = max(gs.resources["cpu"]*MAXIMUM_RESOURCE_USAGE - gs.resources_used["cpu"], 0)
                rate_cpu = gs_cpu_available / (self.current_request.cpu_required
                                    if self.current_request.cpu_required > 0 else 1)
                initial_mark += int(rate_cpu * 2.5)  # Up to 2.5
                gs_power_available = max(gs.resources["power"]*MAXIMUM_RESOURCE_USAGE - gs.resources_used["power"], 0)
                rate_power = gs_power_available / (self.current_request.power_required
                                    if self.current_request.power_required > 0 else 1)
                initial_mark += int(rate_power * 2.5)  # Up to 2.5
                usage = gs.get_mean_usage()
                if usage >= 0.6:
                    initial_mark -= int((usage - 0.6) / 0.4 * 4)  # Deduct up to 4 points if usage > 60%
                score = min(initial_mark, 10)/10.0
        reward += (GS_proximity_bonus) * (score - 7)/10.0 *1/4  # Max bonus if remark is 10, penalty if remark < 7
            
        
        if obs[-1] == 1:
            #Reached groundstation
            reward += finished_pool/2
            if self.steps <= MAX_STEP/3:
                reward += SPEACIAL_BONUS*((1-((self.steps-1)/(MAX_STEP/3)))**2)
            cpu_bonus = self.current_request.cpu_allocated / self.current_request.cpu_required if self.current_request.cpu_required > 0 else 1.0
            cpu_bonus *= finished_pool/4
            power_bonus = self.current_request.power_allocated / self.current_request.power_required if self.current_request.power_required > 0 else 1.0
            power_bonus *= finished_pool/4
            reward += cpu_bonus + power_bonus
        if self.neighbor_ids[0] is None and obs[-1] != 1:
            #No where to go
            reward += DEAD_END_PENALTY
            check = True
        if self.steps > MAX_STEP:
            reward += STEP_LIMIT_PENALTY
            check = True
        reward /= NORM_BASE  # Normalize reward
        reward = max(min(reward, 2.0), -2.0)
        if not check and obs[-1] != 1:
            reward /= INTER_STEP_NORM
        return reward
        
    
    def _apply_action(self, action):
        maximum_resource_usage = 0.9
        if self.current_request.type == ServiceType.EMERGENCY:
            maximum_resource_usage = 0.95
        limit = 0
        for i in range(10):
            if self.neighbor_ids[i]:
                limit += 1
            else:
                break
        if action < 0 or action >= limit:
            self.isvalid_action = False
            return False
        next_node_id = self.neighbor_ids[action]
        next_node = self.network.get_node_by_id(next_node_id)
        if next_node is None:
            return False
        if self.current_node is not None:
            current_lat = self.current_node.position["lat"]
            current_lon = self.current_node.position["lon"]
            current_alt = self.current_node.position["alt"]
        else:
            current_lat = self.current_request.source_location["lat"]
            current_lon = self.current_request.source_location["lon"]
            current_alt = self.current_request.source_location["alt"]
        distance = next_node.calculate_distance(
            current_lat,
            current_lon,
            current_alt
        )
        current_node_type = self.current_node.typename if self.current_node else "user"
        if current_node_type == "satellite":
            current_node_type = self.current_node.type
        node_type = next_node.typename
        if node_type == "satellite":
            node_type = next_node.type
        link_delay = calc_link_delay_ms(
            distance,
            current_node_type,
            node_type,
            self.current_request.type
        )
        link_reliab = link_reliability(
            current_node_type,
            node_type,
            distance
        )
        self.current_request.path.append(next_node.id)
        self.node_passed_ids.append(next_node.id)
        self.current_request.latency_actual += link_delay
        self.current_request.reliability_actual *= link_reliab
        avail_uplink = max(next_node.resources["uplink"] * maximum_resource_usage - next_node.resources_used["uplink"], 0)
        avail_downlink = max(next_node.resources["downlink"] * maximum_resource_usage - next_node.resources_used["downlink"], 0)
        uplink_alloc = min(avail_uplink, self.current_request.uplink_allocated)
        downlink_alloc = min(avail_downlink, self.current_request.downlink_allocated)
        self.current_request.uplink_allocated = uplink_alloc
        self.current_request.downlink_allocated = downlink_alloc
        if next_node.typename == "groundstation":
            avail_cpu = max(next_node.resources["cpu"] * maximum_resource_usage - next_node.resources_used["cpu"], 0)
            avail_power = max(next_node.resources["power"] * maximum_resource_usage - next_node.resources_used["power"], 0)
            cpu_alloc = min(avail_cpu, self.current_request.cpu_required)
            power_alloc = min(avail_power, self.current_request.power_required)
            self.current_request.cpu_allocated = cpu_alloc
            self.current_request.power_allocated = power_alloc
        self.current_node = next_node
        self.steps += 1
        self.isvalid_action = True
        return True
    
    def step(self, action):
        state = self._apply_action(action)
        obs = self._get_obs()  # Get the current observation
        # self.log_info(obs)
        reward = self._calculate_reward(obs)
        if state == False:
            #Hành động không hợp lệ
            reward = INVALID_ACTION_PENALTY
            return obs, reward/NORM_BASE, False, False, {} #This is an invalid action, the apply action return False mean it didnt apply it so just reward and keep current state to try another action
        self._log_reward = reward
        #Calculate score base on QOS:
        score = 0
        #get weights
        weights = BonusProfilesForService.get(self.current_request.type, (0.25, 0.25, 0.25, 0.25))
        w_lat, w_rel, w_up, w_down = weights
        #Latency
        lat_ratio = obs[21]  # Latency required / latency currently
        lat = 10 * w_lat * lat_ratio
        score += lat
        #Reliability
        rel_ratio = obs[19]  # Current reliability / reliability required
        rel = 10 * w_rel * rel_ratio
        score += rel
        #Uplink
        up_ratio = obs[10]  # Uplink allocated / uplink required
        up = 10 * w_up * up_ratio
        score += up
        #Downlink
        down_ratio = obs[12]  # Downlink allocated / downlink required
        down = 10 * w_down * down_ratio
        score += down
        #Timeout
        timeout_ratio = obs[27]  # Timeout remaining / estimated timeout
        time = 2 * timeout_ratio
        score += time
        score = round(score, 2)
        self._log_score = score
        if self.steps > self.MAX_STEP and obs[-1] != 1:
            return obs, reward, True, False, {"score" : 0, "reward": reward, "qscore": score, "latency": lat_ratio, "reliability": rel_ratio, "uplink": up_ratio, "downlink": down_ratio, "timeout": timeout_ratio}
        if self.neighbor_ids[0] is None and obs[-1] != 1:
            #Dead end
            return obs, reward, True, False, {"score" : 0, "reward": reward, "qscore": score, "latency": lat_ratio, "reliability": rel_ratio, "uplink": up_ratio, "downlink": down_ratio, "timeout": timeout_ratio}
        done = True if obs[-1] == 1 else False
        if self.current_node:
            if self.current_node.typename == "groundstation":
                done = True
        info = {"score" : 1, "reward":reward, "qscore": score, "latency": lat_ratio, "reliability": rel_ratio, "uplink": up_ratio, "downlink": down_ratio, "timeout": timeout_ratio}
        if not done:
            return obs, reward, False, False, {}
        else:
            self.connections.append(self.current_request)
            self.groundspace.add_request(self.current_request)
            for id in self.node_passed_ids:
                node = self.network.get_node_by_id(id)
                if node:
                    node.allocate_resource(self.current_request)
            self.count += 1
            # self.log_path()
            return obs, reward, True, False, info
    
    def log_path(self, success = True):
        """Write the path of the finished request to the path log."""
        if not self.current_request:
            return

        # Build readable path (IDs or names)
        path_names = []
        for node_id in self.node_passed_ids:
            path_names.append(node_id)
        
        #Succeeded episode summary
        # self.total_episodes += 1
        # self.running_score += (self._log_score - self.running_score) / self.total_episodes

        with open(self.path_log_file, "a", encoding="utf-8") as f:
            f.write(f"[Request {self.current_request.request_id}] Type={self.current_request.type.name}\n")
            f.write(f"Path: {' → '.join(path_names) if path_names else 'No path'}\n")
            f.write(f"Total hops: {len(path_names)} ({self.steps}) | Reward = {self._log_reward}  | Score = {self._log_score} | Success={success}\n")
            # f.write(f"Average Score: {self.running_score} over {self.total_episodes} episodes\n")
            f.write("-" * 60 + "\n")
            
    def log_remove(self, node: node, request: request):
        """Write the node have been released from request to the release log."""

        with open(self.release_log_file, "a", encoding="utf-8") as f:
            f.write(f"[Request {request.request_id}] Released from Node {node.id}\n")
            f.write("-" * 60 + "\n")
            
    def log_info(self, obs):
        #log current observation, current request, all environemnt variables
        with open(self.step_log_file, "a") as f:
            f.write(f"=== New Step ===\n")
            f.write(f"Current Request: {self.current_request}\n")
            f.write(f"Step: {self.steps}\n")
            f.write(f"Current Node: {self.current_node.id if self.current_node else 'None'}\n")
            f.write(f"Node Passed: {self.node_passed_ids}\n")
            f.write(f"Neighbor IDs: {self.neighbor_ids}\n")
            # f.write(f"Observation: {obs}\n")
            f.write(f"Connections: {[req.request_id for req in self.connections]}\n")
            f.write(f"Waiting Queue: {[req.id for req in self.waiting_queue]}\n")
            #Log the raw obs vector
            f.write("*"*60 + "\n\n")
            


