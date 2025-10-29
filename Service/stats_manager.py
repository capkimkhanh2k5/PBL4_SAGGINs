import csv
import os
import threading
import time
from dataclasses import dataclass, asdict

# (Welford's online algorithm for running variance)
@dataclass
class RunningStats:
    n: int = 0
    mean: float = 0.0
    M2: float = 0.0

    def update(self, x: float):
        if x is None:
            return
        self.n += 1
        delta = x - self.mean
        self.mean += delta / self.n
        delta2 = x - self.mean
        self.M2 += delta * delta2

    @property
    def variance(self) -> float:
        """ Tính phương sai """
        if self.n < 2:
            return 0.0
        return self.M2 / (self.n - 1)
    
    @property
    def std_dev(self) -> float:
        """ Tính độ lệch chuẩn """
        return self.variance ** 0.5


@dataclass
class StatEntry:
    """Đại diện cho một dòng dữ liệu sẽ được ghi vào file log."""
    timestamp: float
    request_id: str
    agent_success: bool
    dijkstra_success: bool
    agent_hops: int
    dijkstra_hops: int
    
    agent_latency: float
    agent_uplink: float
    agent_downlink: float
    agent_reliability: float
    agent_cpu: float
    agent_power: float
    
    dijkstra_latency: float
    dijkstra_uplink: float
    dijkstra_downlink: float
    dijkstra_reliability: float
    dijkstra_cpu: float
    dijkstra_power: float
    

class StatsManager:
    def __init__(self, log_file = "comparison_log.csv"):
        self.log_file = log_file
        self.lock = threading.Lock()
        
        # --- Các chỉ số tổng hợp "In-Memory" ---
        self.total_requests = 0
        self.agent_total_success = 0
        self.dijkstra_total_success = 0

        self.agent_total_win = 0;
        self.dijkstra_total_win = 0;
        self.total_draws = 0;
        
        self.agent_hops_stats = RunningStats()
        self.dijkstra_hops_stats = RunningStats()
        self.agent_latency_stats = RunningStats()
        self.dijkstra_latency_stats = RunningStats()
        self.agent_uplink_stats = RunningStats()
        self.dijkstra_uplink_stats = RunningStats()
        self.agent_downlink_stats = RunningStats()
        self.dijkstra_downlink_stats = RunningStats()
        self.agent_reliability_stats = RunningStats()
        self.dijkstra_reliability_stats = RunningStats()
        self.agent_cpu_stats = RunningStats()
        self.dijkstra_cpu_stats = RunningStats()
        self.agent_power_stats = RunningStats()
        self.dijkstra_power_stats = RunningStats()

        # comprate node usage performance
        self.agent_alloc_uplink_stddev_stats = RunningStats()
        self.agent_alloc_downlink_stddev_stats = RunningStats()
        self.agent_alloc_cpu_stddev_stats = RunningStats()
        self.agent_alloc_power_stddev_stats = RunningStats()

        self.dijsktra_alloc_uplink_stddev_stats = RunningStats()
        self.dijsktra_alloc_downlink_stddev_stats = RunningStats()
        self.dijsktra_alloc_cpu_stddev_stats = RunningStats()
        self.dijsktra_alloc_power_stddev_stats = RunningStats()

        # Group 50 request => Create chart line
        self.BATCH_SIZE = 50
        self.current_batch = [] #Save 50 request tmp
        self.time_series_data = [] #data for chart

        
        self.log_fieldnames = [
            "timestamp", "request_id", "agent_success", "dijkstra_success",
            "agent_hops", "dijkstra_hops",
            "agent_latency", "agent_uplink", "agent_downlink", "agent_reliability", "agent_cpu", "agent_power",
            "dijkstra_latency", "dijkstra_uplink", "dijkstra_downlink", "dijkstra_reliability", "dijkstra_cpu", "dijkstra_power"
        ]
        
        self._load_from_log()

    def _load_from_log(self):
        if not os.path.exists(self.log_file):
            self._write_header()
            return
            
        try:
            with open(self.log_file, mode='r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                if not reader.fieldnames or set(reader.fieldnames) != set(self.log_fieldnames):
                    print(f"Warning: Log file '{self.log_file}' has header incorrect. Restart...")
                    self._write_header(overwrite=True)
                    return

                rows_loaded = 0
                for row in reader:
                    try:
                        entry = StatEntry(
                            timestamp=float(row['timestamp']),
                            request_id=row['request_id'],
                            agent_success=row['agent_success'].lower() == 'true',
                            dijkstra_success=row['dijkstra_success'].lower() == 'true',
                            agent_hops=int(row['agent_hops']),
                            dijkstra_hops=int(row['dijkstra_hops']),
                            
                            agent_latency=float(row['agent_latency']),
                            agent_uplink=float(row['agent_uplink']),
                            agent_downlink=float(row['agent_downlink']),
                            agent_reliability=float(row['agent_reliability']),
                            agent_cpu=float(row['agent_cpu']),
                            agent_power=float(row['agent_power']),
                            
                            dijkstra_latency=float(row['dijkstra_latency']),
                            dijkstra_uplink=float(row['dijkstra_uplink']),
                            dijkstra_downlink=float(row['dijkstra_downlink']),
                            dijkstra_reliability=float(row['dijkstra_reliability']),
                            dijkstra_cpu=float(row['dijkstra_cpu']),
                            dijkstra_power=float(row['dijkstra_power'])
                        )

                        self._update_memory_stats(entry)    
                        self._update_time_series(entry)

                        winner = self._calculate_request_winner(entry)
                        if winner == 1:
                            self.agent_total_win += 1
                        elif winner == -1:
                            self.dijkstra_total_win += 1
                        else:
                            self.total_draws += 1

                        rows_loaded += 1
                    except Exception as e:
                        print(f"Error in line of log: {row}. Error: {e}")
                
                #print(f"StatsManager: Completed loading {rows_loaded} history recorded from '{self.log_file}'.")
        
        except Exception as e:
            print(f"Error in loading file log: {e}")

    def _write_header(self, overwrite=False):
        mode = 'w' if overwrite else 'a'
        if overwrite or not os.path.exists(self.log_file) or os.path.getsize(self.log_file) == 0:
            try:
                with open(self.log_file, mode=mode, newline='', encoding='utf-8') as f:
                    writer = csv.DictWriter(f, fieldnames=self.log_fieldnames)
                    writer.writeheader()
            except Exception as e:
                print(f"Error in writing log header: {e}")

    def _log_to_csv(self, entry: StatEntry):
        try:
            with open(self.log_file, mode='a', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=self.log_fieldnames)
                writer.writerow(asdict(entry))
        except Exception as e:
            print(f"Error in writing to file log: {e}")

    def _update_memory_stats(self, entry: StatEntry):
        """Hàm nội bộ để cập nhật các biến "in-memory"."""
        self.total_requests += 1
        if entry.agent_success:
            self.agent_total_success += 1
        if entry.dijkstra_success:
            self.dijkstra_total_success += 1
            
        self.agent_hops_stats.update(entry.agent_hops)
        self.dijkstra_hops_stats.update(entry.dijkstra_hops)
        
        self.agent_latency_stats.update(entry.agent_latency)
        self.agent_uplink_stats.update(entry.agent_uplink)
        self.agent_downlink_stats.update(entry.agent_downlink)
        self.agent_reliability_stats.update(entry.agent_reliability)
        self.agent_cpu_stats.update(entry.agent_cpu)
        self.agent_power_stats.update(entry.agent_power)
        
        self.dijkstra_latency_stats.update(entry.dijkstra_latency)
        self.dijkstra_uplink_stats.update(entry.dijkstra_uplink)
        self.dijkstra_downlink_stats.update(entry.dijkstra_downlink)
        self.dijkstra_reliability_stats.update(entry.dijkstra_reliability)
        self.dijkstra_cpu_stats.update(entry.dijkstra_cpu)
        self.dijkstra_power_stats.update(entry.dijkstra_power)

        self.agent_alloc_uplink_stddev_stats.update(entry.agent_uplink)
        self.agent_alloc_downlink_stddev_stats.update(entry.agent_downlink)
        self.agent_alloc_cpu_stddev_stats.update(entry.agent_cpu)
        self.agent_alloc_power_stddev_stats.update(entry.agent_power)

        self.dijsktra_alloc_uplink_stddev_stats.update(entry.dijkstra_uplink)
        self.dijsktra_alloc_downlink_stddev_stats.update(entry.dijkstra_downlink)
        self.dijsktra_alloc_cpu_stddev_stats.update(entry.dijkstra_cpu)
        self.dijsktra_alloc_power_stddev_stats.update(entry.dijkstra_power)


    #Calculate point for chart line
    def _calculate_request_winner(self, entry: StatEntry):
        """
            Chấm điểm mỗi request
            Agent Thắng 1 Thua -1 Hoà 0 so với Dijsktra
        """
        if not entry.dijkstra_hops:
            return 1;
        
        agent_score = 0;
        dijkstra_score = 0;
    
        if entry.agent_hops < entry.dijkstra_hops:
            agent_score += 1
        elif entry.agent_hops > entry.dijkstra_hops:
            dijkstra_score += 1

        if entry.agent_latency < entry.dijkstra_latency:
            agent_score += 1
        elif entry.agent_latency > entry.dijkstra_latency:
            dijkstra_score += 1

        if entry.agent_uplink < entry.dijkstra_uplink:
            agent_score += 1
        elif entry.agent_uplink > entry.dijkstra_uplink:
            dijkstra_score += 1

        if entry.agent_downlink < entry.dijkstra_downlink:
            agent_score += 1    
        elif entry.agent_downlink > entry.dijkstra_downlink:
            dijkstra_score += 1

        if entry.agent_reliability < entry.dijkstra_reliability:
            agent_score += 1
        elif entry.agent_reliability > entry.dijkstra_reliability:
            dijkstra_score += 1

        if entry.agent_cpu < entry.dijkstra_cpu:
            agent_score += 1
        elif entry.agent_cpu > entry.dijkstra_cpu:
            dijkstra_score += 1

        if entry.agent_power < entry.dijkstra_power:
            agent_score += 1
        elif entry.agent_power > entry.dijkstra_power:
            dijkstra_score += 1

        if agent_score > dijkstra_score:
            return 1
        elif agent_score < dijkstra_score:
            return -1
        else:
            return 0

    def _process_batch(self):
        if not self.current_batch:
            return
        
        batch_len = len(self.current_batch)
        agent_wins = 0
        dijkstra_wins = 0
        draws = 0

        for entry in self.current_batch:
            winner = self._calculate_request_winner(entry)
            if winner == 1:
                agent_wins += 1
            elif winner == -1:
                dijkstra_wins += 1
            else:
                draws += 1
        
        if batch_len == 0:
            agent_win_rate = 0.0
            dijkstra_win_rate = 0.0
            draw_rate = 0.0
        else:
            agent_win_rate = (agent_wins / batch_len) * 100
            dijkstra_win_rate = (dijkstra_wins / batch_len) * 100
            draw_rate = (draws / batch_len) * 100
        
        batch_number = len(self.time_series_data) + 1
        
        self.time_series_data.append({
            "name": f"Batch {batch_number}",
            "agent_win_rate": round(agent_win_rate, 2),
            "dijkstra_win_rate": round(dijkstra_win_rate, 2),
            "draw_rate": round(draw_rate, 2)
        })
        
        self.current_batch = [] # Delete batch 
        
    def _update_time_series(self, entry: StatEntry):
        self.current_batch.append(entry)
        if len(self.current_batch) >= self.BATCH_SIZE:
            self._process_batch()

    def record_request(self, request_id: str, agent_result: dict, dijkstra_result: dict):
        """
        Được gọi mỗi khi có một request được xử lý.
        
        agent_result: {"success": bool, "path": list, "latency": float, "uplink": float, ...}
        dijkstra_result: {"success": bool, "path": list, "latency": float, "uplink": float, ...}
        """
        with self.lock:
            try:
                # <<< CẬP NHẬT TẠO STATENTRY VỚI TẤT CẢ 6 CHỈ SỐ >>>
                entry = StatEntry(
                    timestamp=time.time(),
                    request_id=request_id,
                    agent_success=agent_result.get("success", False),
                    dijkstra_success=dijkstra_result.get("success", False),
                    agent_hops=len(agent_result.get("path", [])),
                    dijkstra_hops=len(dijkstra_result.get("path", [])),
                    
                    agent_latency=agent_result.get("latency", 0.0),
                    agent_uplink=agent_result.get("uplink", 0.0),
                    agent_downlink=agent_result.get("downlink", 0.0),
                    agent_reliability=agent_result.get("reliability", 0.0),
                    agent_cpu=agent_result.get("cpu", 0.0),
                    agent_power=agent_result.get("power", 0.0),

                    dijkstra_latency=dijkstra_result.get("latency", 0.0),
                    dijkstra_uplink=dijkstra_result.get("uplink", 0.0),
                    dijkstra_downlink=dijkstra_result.get("downlink", 0.0),
                    dijkstra_reliability=dijkstra_result.get("reliability", 0.0),
                    dijkstra_cpu=dijkstra_result.get("cpu", 0.0),
                    dijkstra_power=dijkstra_result.get("power", 0.0)
                )
                
                self._update_memory_stats(entry)
                self._log_to_csv(entry)
                self._update_time_series(entry)

                winner = self._calculate_request_winner(entry)
                if winner == 1:
                    self.agent_total_win += 1
                elif winner == -1:
                    self.dijkstra_total_win += 1
                else:
                    self.total_draws += 1
                
            except Exception as e:
                print(f"Error in function record_request: {e}")

    def get_aggregate_stats(self) -> dict:
        """
            Create API
            Trả về các chỉ số thống kê tổng hợp hiện tại.
        """
        with self.lock:
            if self.total_requests == 0:
                agent_success_rate = 0.0
                dijkstra_success_rate = 0.0
                overall_agent_win_rate = 0.0
                overall_dijkstra_win_rate = 0.0
                overall_draw_rate = 0.0
            else:
                agent_success_rate = (self.agent_total_success / self.total_requests) * 100
                dijkstra_success_rate = (self.dijkstra_total_success / self.total_requests) * 100

                overall_agent_win_rate = (self.agent_total_win / self.total_requests) * 100
                overall_dijkstra_win_rate = (self.dijkstra_total_win / self.total_requests) * 100
                overall_draw_rate = (self.total_draws / self.total_requests) * 100
            
            # <<< TRẢ VỀ TẤT CẢ STATS >>>
            stats = {
                "total_requests": self.total_requests,
                
                "agent_success_rate": agent_success_rate,
                "dijkstra_success_rate": dijkstra_success_rate,

                "overall_agent_win_rate": overall_agent_win_rate,
                "overall_dijkstra_win_rate": overall_dijkstra_win_rate,
                "overall_draw_rate": overall_draw_rate,
                
                "agent_avg_hops": self.agent_hops_stats.mean,
                "dijkstra_avg_hops": self.dijkstra_hops_stats.mean,

                "agent_avg_latency": self.agent_latency_stats.mean,
                "dijkstra_avg_latency": self.dijkstra_latency_stats.mean,

                "agent_avg_uplink": self.agent_uplink_stats.mean,
                "dijkstra_avg_uplink": self.dijkstra_uplink_stats.mean,
                
                "agent_avg_downlink": self.agent_downlink_stats.mean,
                "dijkstra_avg_downlink": self.dijkstra_downlink_stats.mean,
                
                "agent_avg_reliability": self.agent_reliability_stats.mean,
                "dijkstra_avg_reliability": self.dijkstra_reliability_stats.mean,
                
                "agent_avg_cpu": self.agent_cpu_stats.mean,
                "dijkstra_avg_cpu": self.dijkstra_cpu_stats.mean,
                
                "agent_avg_power": self.agent_power_stats.mean,
                "dijkstra_avg_power": self.dijkstra_power_stats.mean,

                "agent_alloc_uplink_stddev": self.agent_alloc_uplink_stddev_stats.std_dev,
                "agent_alloc_downlink_stddev": self.agent_alloc_downlink_stddev_stats.std_dev,
                "agent_alloc_cpu_stddev": self.agent_alloc_cpu_stddev_stats.std_dev,
                "agent_alloc_power_stddev": self.agent_alloc_power_stddev_stats.std_dev,

                "dijkstra_alloc_uplink_stddev": self.dijsktra_alloc_uplink_stddev_stats.std_dev,
                "dijkstra_alloc_downlink_stddev": self.dijsktra_alloc_downlink_stddev_stats.std_dev,
                "dijkstra_alloc_cpu_stddev": self.dijsktra_alloc_cpu_stddev_stats.std_dev,
                "dijkstra_alloc_power_stddev": self.dijsktra_alloc_power_stddev_stats.std_dev,
            }
            return stats
        

    def get_time_series_stats(self) -> list:
        """
            Create API
            Trả về dữ liệu thành công theo từng batch
        """
        with self.lock:
            self._process_batch()
            return list(self.time_series_data[-10:])