import math
import threading
from request import ServiceType, request

EARTH_RADIUS = 6371000

class node():
    def __init__(self, position, resources):
        self.position = position
        if len(self.position) != 3:
            self.position["alt"] = 0
        self.resources = resources
        self.resources_used = {}
        self.connections = []
        for i in self.resources.keys():
            self.resources_used[i] = 0
        self.typename = "node"
        self.type = ""
        self.id = "Node"
        self.lock = threading.Lock()

    import math

    def calculate_distance(self, lat2, lon2, alt2=0, mode="3d"):
        lat1 = self.position["lat"]
        lon1 = self.position["lon"]
        alt1 = self.position["alt"]

        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        lam1, lam2 = math.radians(lon1), math.radians(lon2)

        if mode == "surface":
            # --- Haversine formula ---
            dphi = phi2 - phi1
            dlam = lam2 - lam1
            a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            return EARTH_RADIUS * c  # mét

        else:  # "3d" hoặc "auto"
            # --- Cartesian ---
            x1 = (EARTH_RADIUS + alt1) * math.cos(phi1) * math.cos(lam1)
            y1 = (EARTH_RADIUS + alt1) * math.cos(phi1) * math.sin(lam1)
            z1 = (EARTH_RADIUS + alt1) * math.sin(phi1)

            x2 = (EARTH_RADIUS + alt2) * math.cos(phi2) * math.cos(lam2)
            y2 = (EARTH_RADIUS + alt2) * math.cos(phi2) * math.sin(lam2)
            z2 = (EARTH_RADIUS + alt2) * math.sin(phi2)

            dx, dy, dz = x2 - x1, y2 - y1, z2 - z1
            return math.sqrt(dx*dx + dy*dy + dz*dz)  # mét

    
    def allocate_resource(self, req: request, allow_partial=True) -> bool:
        """
        Try to allocate resources (bandwidth, CPU, power) for a request.
        Returns True if at least partial allocation succeeded, False otherwise.
        """
        with self.lock:
            self.resources_used["uplink"] += req.uplink_allocated
            self.resources_used["downlink"] += req.downlink_allocated
            if self.typename == "groundstation":
                self.resources_used["cpu"] += req.cpu_allocated
                self.resources_used["power"] += req.power_allocated
        return True
    
    def release_resource(self, req: request):
        # Release resources
        with self.lock:
            self.resources_used["uplink"] -= req.uplink_allocated
            self.resources_used["downlink"] -= req.downlink_allocated
            if self.typename == "groundstation":
                self.resources_used["cpu"] -= req.cpu_allocated
                self.resources_used["power"] -= req.power_allocated
        return True
    
    def can_connect(self, dev_lat, dev_lon, dev_alt=0, is_sat = False):
        raise NotImplementedError("This method should be implemented in subclasses")
    
    #kiểm tra node là GS
    def is_GS(self):
        return self.typename == "ground_station"
    
    #Lấy tổng resources
    def get_total_resources(self):
        return (self.resources.get("uplink", 0),
                self.resources.get("downlink", 0),
                self.resources.get("cpu", 0),
                self.resources.get("power", 0))
        
    def get_free_resources(self):
        free_uplink = self.resources["uplink"] - self.resources_used["uplink"]
        free_downlink = self.resources["downlink"] - self.resources_used["downlink"]
        free_cpu = self.resources.get("cpu", 0) - self.resources_used.get("cpu", 0)
        free_power = self.resources.get("power", 0) - self.resources_used.get("power", 0)
        return (free_uplink, free_downlink, free_cpu, free_power)
        
    #Add connection (dùng trong mô phỏng)
    def add_connection(self, conn_info):
        self.connections.append(conn_info)
        
        
    def get_mean_usage(self):
        uplink_usage = (self.resources_used["uplink"] / self.resources["uplink"]
                        if self.resources["uplink"] > 0 else 0)
        downlink_usage = (self.resources_used["downlink"] / self.resources["downlink"]
                          if self.resources["downlink"] > 0 else 0)
        if self.typename != "groundstation":
            return (uplink_usage + downlink_usage) / 2
        cpu_usage = (self.resources_used["cpu"] / self.resources["cpu"]
                     if self.resources["cpu"] > 0 else 0)
        power_usage = (self.resources_used["power"] / self.resources["power"]
                       if self.resources["power"] > 0 else 0)
        return (uplink_usage + downlink_usage + cpu_usage + power_usage) / 4