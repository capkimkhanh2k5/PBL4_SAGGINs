import gymnasium as gym
import torch
import numpy as np
from sb3_contrib import QRDQN
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.logger import configure
from Environment import SagsEnv

# ======== Custom Logging Callback ==========
# class RewardLoggingCallback(BaseCallback):
#     def __init__(self, print_freq=100, verbose=1):
#         super().__init__(verbose)
#         self.print_freq = print_freq
#         self.total_eps = 0
#         self.running_mean = 0.0

#     def _on_step(self) -> bool:
#         infos = self.locals.get("infos")
#         if not infos:
#             return True

#         info = infos[0]
#         if info.get("score") is not None:
#             self.total_eps += 1
#             score = info["score"]
#             self.running_mean += (score - self.running_mean) / self.total_eps

#             if self.total_eps % self.print_freq == 0:
#                 print(f"[Episode {self.total_eps}] Mean Score (running): {self.running_mean:.3f}")
#                 #Display the most recent episode score for latency, reliability, uplink, downlink and time
#                 # if info.get("latency") is not None:
#                 #     print(f"  Latency: {info['latency']:.3f}, Reliability: {info['reliability']:.3f}, Uplink: {info['uplink']:.3f}, Downlink: {info['downlink']:.3f}, Timeout: {info['timeout']:.3f}")
#         return True

class RewardLoggingCallback(BaseCallback):
    def __init__(self, print_freq=100, verbose=1):
        super().__init__(verbose)
        self.print_freq = print_freq
        self.total_eps = 0
        self.running_mean = 0.0

    def _on_step(self) -> bool:
        infos = self.locals.get("infos")
        if not infos:
            return True

        info = infos[0]
        if "score" in info:
            self.total_eps += 1
            score = info["score"]  # 1 = success, 0 = fail
            self.running_mean += (score - self.running_mean) / self.total_eps

            if self.total_eps % self.print_freq == 0:
                print(f"[Episode {self.total_eps}] Success rate: {self.running_mean * 100:.2f}%")

        return True

def make_env():
    env = SagsEnv()
    env = Monitor(env)  # adds reward & episode length tracking
    return env

def main():
    # ======== Environment ==========
    env = make_env()

    # ======== Logger Setup ==========
    log_dir = "./logs/qrdqn_sagsenv/"
    new_logger = configure(log_dir, ["tensorboard", "csv"])


    # ======== Model Setup ==========
    model = QRDQN(
        "MlpPolicy",
        env,
        learning_rate=2e-4,            
        buffer_size=100_000,           # sufficient for diversity
        learning_starts=5_000,        # start learning earlier
        batch_size=256,                
        tau=0.005,                     
        gamma=0.99,
        verbose = 0,
        train_freq=4,                  
        gradient_steps=4,              
        target_update_interval=1,       # soft updates used
        exploration_fraction=0.1,      
        exploration_final_eps=0.01,    
        max_grad_norm=10,              
        tensorboard_log= log_dir,  
        device="auto",
        policy_kwargs=dict(
            net_arch=[256, 128],       
            n_quantiles=51,           
            activation_fn=torch.nn.ReLU
        )
    )

    model.set_logger(new_logger)

    # ======== Training ==========
    callback = RewardLoggingCallback(print_freq=100)
    model.learn(total_timesteps=10000, callback=callback, log_interval=100)

    # ======== Save Model ==========
    model.save("qrdqn_model2")
    model.save_replay_buffer("qrdqn_buffer2")

    print("✅ Training finished and model saved.")

if __name__ == "__main__":
    main()
