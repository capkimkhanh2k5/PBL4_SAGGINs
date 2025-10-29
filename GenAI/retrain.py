import gymnasium as gym
import torch
import numpy as np
from sb3_contrib import QRDQN
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.logger import configure
from stable_baselines3.common.buffers import ReplayBuffer
from Environment import SagsEnv


# =====================================================
# 🧩 Reward Logging Callback
# =====================================================
class RewardLoggingCallback(BaseCallback):
    def __init__(self, print_freq=100, verbose=1):
        super().__init__(verbose)
        self.print_freq = print_freq
        self.total_eps = 0
        self.running_mean = 0.0
        self.running_reward = 0.0
        self.running_qscore = 0.0
        self.running_qos = {"latency" : 0.0, "reliability": 0.0, "uplink": 0.0, "downlink": 0.0, "timeout" : 0.0}

    def _on_step(self) -> bool:
        # Get 'infos' and 'dones' from the current step
        infos = self.locals.get("infos", [])
        dones = self.locals.get("dones", [])

        for info, done in zip(infos, dones):
            if done and "score" in info and "reward" in info and "qscore" in info:
                # Episode ended
                self.total_eps += 1
                score = info["score"]
                reward = info["reward"]
                qscore = info["qscore"]
                for key in self.running_qos.keys():
                    if key in info:
                        self.running_qos[key] += (info[key] - self.running_qos[key]) / self.total_eps

                self.running_mean += (score - self.running_mean) / self.total_eps
                self.running_reward += (reward - self.running_reward) / self.total_eps
                self.running_qscore += (qscore - self.running_qscore) / self.total_eps

                if self.total_eps % self.print_freq == 0:
                    print(f"[Episode {self.total_eps}] Success rate: {self.running_mean * 100:.2f}%")
                    print(f"  Average Reward: {self.running_reward:.2f}")
                    print(f"  Average Q-Score: {self.running_qscore*100/12:.2f}%")
                    print(f"  Average QoS: " + ", ".join([f"{k}: {v*100:.2f}%" for k, v in self.running_qos.items()]))

        return True


# =====================================================
# 🧩 Replay Buffer Trimmer
# =====================================================
def trim_replay_buffer(model, keep_ratio=0.1):
    """
    Trim the replay buffer of an SB3 QRDQN/DQN model to keep only the most recent experiences.
    """
    buf = getattr(model, "replay_buffer", None)
    if buf is None:
        print("[trim_replay_buffer] No replay buffer found in model.")
        return

    # Ensure buffer has content
    size = buf.size()
    if size == 0:
        print("[trim_replay_buffer] Replay buffer is empty.")
        return

    # Compute how many transitions to keep
    keep_ratio = max(0.0, min(1.0, keep_ratio))
    n_keep = int(size * keep_ratio)

    if n_keep == 0:
        buf.pos = 0
        buf.full = False
        print("[trim_replay_buffer] Cleared buffer (kept 0 samples).")
        return

    # Handle circular buffer (full)
    if buf.full:
        start_index = (buf.pos - n_keep) % buf.buffer_size
        if start_index + n_keep <= buf.buffer_size:
            for field_name, field in buf.__dict__.items():
                if hasattr(field, "__getitem__") and hasattr(field, "__setitem__"):
                    buf.__dict__[field_name][:n_keep] = field[start_index:start_index + n_keep]
        else:
            first_part = buf.buffer_size - start_index
            for field_name, field in buf.__dict__.items():
                if hasattr(field, "__getitem__") and hasattr(field, "__setitem__"):
                    buf.__dict__[field_name][:n_keep] = np.concatenate(
                        (field[start_index:], field[:n_keep - first_part]), axis=0
                    )
    else:
        # Not full
        for field_name, field in buf.__dict__.items():
            if hasattr(field, "__getitem__") and hasattr(field, "__setitem__"):
                buf.__dict__[field_name][:n_keep] = field[buf.pos - n_keep:buf.pos]

    buf.pos = n_keep
    buf.full = False
    print(f"[trim_replay_buffer] Trimmed replay buffer to last {n_keep} samples ({keep_ratio*100:.1f}%).")


# =====================================================
# 🧩 Environment Factory
# =====================================================
def make_env():
    env = SagsEnv()
    # env.reset(seed=42)
    env = Monitor(env)
    return env


# =====================================================
# 🧩 Main Training Function
# =====================================================
def continue_training(trim_ratio=None, new_buffer_size=None):
    # ======== Environment ==========
    env = make_env()

    # ======== Load Existing Model ==========
    print("Loading pre-trained model...")
    model = QRDQN.load(
        "qrdqn_model",
        env=env,
        device="auto"
    )
    
    # model.learning_rate = 1e-4
    # model.tau = 0.005  # More stable updates
    # model.learning_starts = 10000 # Start learning after 10k steps
    # model.target_update_interval = 1  # More frequent target updates

    # ======== Replay Buffer Handling ==========
    if new_buffer_size is not None:
        # 🆕 Create a new replay buffer with the desired size
        from stable_baselines3.common.buffers import ReplayBuffer

        model.replay_buffer = ReplayBuffer(
            buffer_size=new_buffer_size,
            observation_space=model.observation_space,
            action_space=model.action_space,
            device=model.device,
            optimize_memory_usage=False,
            handle_timeout_termination=True
        )
        print(f"🧾 Created a NEW replay buffer (size={new_buffer_size}).")
    else:
        # Try loading existing replay buffer if available
        try:
            model.load_replay_buffer("qrdqn_buffer")
            print("✅ Replay buffer loaded successfully")

            # Optional trimming step
            if trim_ratio is not None:
                trim_replay_buffer(model, keep_ratio=trim_ratio)

        except Exception as e:
            print(f"⚠️ Could not load replay buffer: {e}")
            print("Starting with empty replay buffer")

    # ======== Continue Training ==========
    callback = RewardLoggingCallback(print_freq=1000)
    print("Continuing training...")

    model.learn(
        total_timesteps=50000,
        callback=callback,
        log_interval=10000,
        reset_num_timesteps=False,
    )

    # ======== Save Updated Model ==========
    model.save("qrdqn_model")
    model.save_replay_buffer("qrdqn_buffer")
    print("✅ Continued training finished and model saved.")



# =====================================================
# 🧩 Entry Point
# =====================================================
if __name__ == "__main__":
    continue_training(trim_ratio=None, new_buffer_size= None)
