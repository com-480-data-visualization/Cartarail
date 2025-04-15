# Full trip: all stations that a trip stops by.

import pandas as pd
import pickle
import os

target = "epfl"

stations = pd.read_csv(f"../data/preprocessed/{target}_stations.csv");
routes = pd.read_csv(f"../data/preprocessed/{target}_routes.csv");
trips = pd.read_csv(f"../data/preprocessed/{target}_trips.csv");
stop_times = pd.read_csv(f"../data/preprocessed/{target}_stop_times.csv");

def allStationsInTrip(trip_id): 
    trip_stop_times = stop_times[stop_times['trip_id'] == trip_id]
    sorted = trip_stop_times.sort_values(by='stop_sequence', ascending=True)
    trip_stations = sorted['parent_station'].tolist()
    return ",".join(trip_stations)

def init(): 
    full_trips = []
    stationseq_dict = {}
    stationseq_cnt = 0
    if (
        os.path.exists("full_trips_backup.pkl") and
        os.path.exists("stationseq_dict_backup.pkl") and
        os.path.exists("stationseq_cnt_backup.pkl")
    ):
        with open("full_trips_backup.pkl", "rb") as f:
            full_trips = pickle.load(f)

        with open("stationseq_dict_backup.pkl", "rb") as f:
            stationseq_dict = pickle.load(f)

        with open("stationseq_cnt_backup.pkl", "rb") as f:
            stationseq_cnt = pickle.load(f)
    else:
        print("One or more backup files are missing. Nothing was loaded.")
    return full_trips, stationseq_dict, stationseq_cnt

def compute_full_trips(): 
    full_trips, stationseq_dict, stationseq_cnt = init()
    processed_trip_ids = set(record['trip_id'] for record in full_trips)

    print(f"len(trips) = {len(trips)}")
    for i, trip_id in enumerate(trips['trip_id']):
        if trip_id in processed_trip_ids:
            continue 
        str = allStationsInTrip(trip_id)
        if str not in stationseq_dict: 
            stationseq_dict[str] = stationseq_cnt 
            stationseq_cnt += 1
        full_trips.append({"trip_id": trip_id, "station_seq_id": stationseq_dict[str]})
        # save
        if i % 100 == 0 and i > 0:
            print(f"Saving backup at trip {i}...")
            with open("full_trips_backup.pkl", "wb") as f:
                pickle.dump(full_trips, f)
            with open("stationseq_dict_backup.pkl", "wb") as f:
                pickle.dump(stationseq_dict, f)
            with open("stationseq_cnt_backup.pkl", "wb") as f:
                pickle.dump(stationseq_cnt, f)
    
    return full_trips, stationseq_dict


def save_stationseq(dict, filename): 
    l = []
    for str, i in dict.items():
        l.append({"station_seq_id": i, "station_seq": str})
    return save_list(l, filename) 

def save_list(l, filename):
    df = pd.DataFrame(l)
    df.to_csv(filename, index=False)
    print(f"Saved: {filename}")
    return df

full_trips, stationseq_dict = compute_full_trips()
save_stationseq(stationseq_dict, f"../data/preprocessed/{target}_station_seqs.csv")
save_list(full_trips, f"../data/preprocessed/{target}_full_trips.csv")

