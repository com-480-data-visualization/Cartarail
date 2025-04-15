# Precompute all possible next stations.

import pandas as pd
import pickle
import os

target = "epfl"

trips = pd.read_csv(f"../data/preprocessed/{target}_trips.csv");
full_trips = pd.read_csv(f"../data/preprocessed/{target}_full_trips.csv");
station_seqs = pd.read_csv(f"../data/preprocessed/{target}_station_seqs.csv");
full_trips_with_route = full_trips.merge(trips[['trip_id', 'route_id']], on='trip_id', how='left')

def check():
    groups = full_trips_with_route.groupby('route_id')['station_seq_id'].nunique()
    routes_d = groups[groups > 1]
    print(f"There are {len(routes_d)} routes with different full trips.")
    print(routes_d)

def compute_next_stations():
    next_stations = {}

    for _, row in station_seqs.iterrows():
        seq = row['station_seq']
        seq_id = row['station_seq_id']
        ss = seq.split(",") 
        for i in range(len(ss) - 1): 
            s_from = ss[i]
            s_to = ss[i+1]
            key = f"{s_from},{s_to}"
            if key not in next_stations: 
                next_stations[key] = set()
            s_routes = set(full_trips_with_route[full_trips_with_route['station_seq_id'] == seq_id]['route_id'].drop_duplicates().iloc[:].astype(str))
            next_stations[key].update(s_routes)

    return next_stations

def save_next_stations(next_stations, filename):
    l = []
    for k, v in next_stations.items():
        ss = k.split(",")
        s_from = ss[0]
        s_to = ss[1]
        for route_id in v: 
            l.append({'from': s_from, 'to': s_to, 'route_id': route_id})
    save_list(l, filename) 

def save_list(l, filename):
    df = pd.DataFrame(l)
    df.to_csv(filename, index=False)
    print(f"Saved: {filename}")
    return df

check()
next_stations = compute_next_stations()
save_next_stations(next_stations, f"../data/preprocessed/{target}_next_stations.csv")
