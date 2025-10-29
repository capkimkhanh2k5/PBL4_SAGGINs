from pymongo import MongoClient
from pymongo.server_api import ServerApi

# -----------------------------
# Config
# -----------------------------
uri = "mongodb+srv://longhoi856:UYcdtPdXsoYGFBrT@cluster0.hb5vpf7.mongodb.net/?retryWrites=true&w=majority"
client = MongoClient(uri, server_api=ServerApi('1'))
DB_NAME = "sagsins"
db = client[DB_NAME]
# collection = db["satellites"]
# collection = db["groundstations"]
collection = db["seastations"]

# -----------------------------
# Scale uplink by 4/5
# -----------------------------

# Fetch all documents
for doc in collection.find({}):
    if "resources" in doc and "uplink" in doc["resources"]:
        current_uplink = doc["resources"]["uplink"]
        new_uplink = current_uplink * 4 / 5
        
        # Update document
        collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {"resources.uplink": new_uplink}}
        )

print("Đã scale tất cả uplink lên 4/5 thành công")
