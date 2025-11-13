# run_check_sb3.py
from sb3_contrib import QRDQN
import zipfile, os

path = "/Users/capkimkhanh/Documents/PBL4/Service/GenAI/qrdqn_model.zip"
model = QRDQN.load(path, device="cpu")

print("n_quantiles (model):", getattr(model, "n_quantiles", None))
print("action space:", model.action_space)           # e.g. Discrete(10)
print("obs space:", model.observation_space)
# nội bộ mạng lượng tử (quantile network)
try:
    print("quantile_net q_net out_features:",
          model.quantile_net.q_net.out_features)
except Exception as e:
    print("Không có thuộc tính quantile_net.q_net.out_features —", e)

# tính số neuron output = n_actions * n_quantiles
nq = getattr(model, "n_quantiles", None)
na = getattr(model.action_space, "n", None)
print("Computed output neurons:", (na * nq) if (nq and na) else "Không đủ thông tin")
