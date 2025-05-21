import pandas as pd
import pickle
import os
from geopy.distance import geodesic

target = "train"

stations = pd.read_csv(f"../data/preprocessed/{target}/stations.csv");

def walkingTime(st_lat, st_lon, ed_lat, ed_lon):
    dist = geodesic((st_lat, st_lon), (ed_lat, ed_lon)).km
    speed = 4 # 4km/h
    return 60 * dist / speed # in minutes

def gen():
    query_table_idx = 0
    query_table = pd.DataFrame(columns=['start_station', 'next_station', 'walk_time'])
    for i, st in stations.iterrows():
        for j, ed in stations.iterrows():
            if i == j:
                continue
            print("i = ", i, " j = ", j)
            t = walkingTime(st['stop_lat'], st['stop_lon'], ed['stop_lat'], ed['stop_lon'])
            if t <= 30: # <= 30 mins
                query_table.loc[query_table_idx] = [st['stop_id'], ed['stop_id'], t]
                query_table_idx += 1
    return query_table

query_table = gen()
query_table.to_csv(f"../data/preprocessed/{target}/walk_table.csv", index=False)
