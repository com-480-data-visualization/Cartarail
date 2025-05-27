import pandas as pd
import pickle
import os
import ast

target = "train"

stations = pd.read_csv(f"../data/preprocessed/{target}/stations.csv");
routes = pd.read_csv(f"../data/preprocessed/{target}/routes.csv");
trips = pd.read_csv(f"../data/preprocessed/{target}/trips.csv");
stop_times = pd.read_csv(f"../data/preprocessed/{target}/stop_times.csv", dtype = {'stop_sequence': int});

trunk_size = 20000
trunk_num  = len(stop_times) // trunk_size + 1

def gen():
    query_table = pd.DataFrame(columns=['start_station', 'next_station', 'trip_id', 'departure_arrival_time'])
    idx = 0
    rows = 0
    last_record = stop_times.iloc[rows]
    for i, record in stop_times.iloc[rows+1:].iterrows():
        if i%1000 == 0:
            print(i)
        if (last_record['trip_id'] == record['trip_id']):
            query_table.loc[idx] = [last_record['parent_station'], record['parent_station'], record['trip_id'], (last_record['departure_time'], record['arrival_time'])]
            idx += 1
        last_record = record
        # save
        if i % trunk_size == 0 and i > 0:
            backup_id = i // trunk_size
            print(f"Saving backup at index {i}... backup_id = {backup_id}")
            query_table.to_csv(f"../data/preprocessed/{target}/query_table_{backup_id}.csv", index=False)
            query_table = pd.DataFrame(columns=['start_station', 'next_station', 'trip_id', 'departure_arrival_time'])
            idx = 0
    backup_id = len(stop_times) // trunk_size + 1
    print(f"Saving backup at index {i}... backup_id = {backup_id}")
    query_table.to_csv(f"../data/preprocessed/{target}/query_table_{backup_id}.csv", index=False)
    query_table = pd.DataFrame(columns=['start_station', 'next_station', 'trip_id', 'departure_arrival_time'])

def read():
    query_table = pd.concat([pd.read_csv(f"../data/preprocessed/{target}/query_table_{i}.csv") for i in range(1, trunk_num + 1)], ignore_index=True);
    query_table['departure_arrival_time'] = query_table['departure_arrival_time'].apply(ast.literal_eval)
    return query_table

def addRouteInfo(query_table):
    query_table = pd.merge(query_table, trips[['trip_id', 'route_id']], on='trip_id', how='inner')
    query_table = pd.merge(query_table, routes[['route_id', 'route_desc', 'route_short_name']], on='route_id', how='inner')
    query_table = query_table.drop(columns=['trip_id'])
    return query_table

def compress(query_table):
    df = query_table.groupby(['start_station', 'next_station', 'route_id', 'route_desc', 'route_short_name'], as_index=False).agg({
        'departure_arrival_time': lambda tuples: sorted(set(tuples), key=lambda t: t[0])
    })
    return df

# gen()
query_table = read()
query_table = addRouteInfo(query_table)
query_table = compress(query_table)
query_table.to_csv(f"../data/preprocessed/{target}/transport_table.csv", index=False)
