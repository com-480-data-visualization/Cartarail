import pandas as pd
import pickle
import os

target = "lausanne"

stations = pd.read_csv(f"../data/preprocessed/{target}/stations.csv");
routes = pd.read_csv(f"../data/preprocessed/{target}/routes.csv");
trips = pd.read_csv(f"../data/preprocessed/{target}/trips.csv");
stop_times = pd.read_csv(f"../data/preprocessed/{target}/stop_times.csv", dtype = {'stop_sequence': int});

def init():
    query_table_bkfname = f"{target}_query_table_backup.pkl"
    query_table = pd.DataFrame(columns=['start_station', 'next_station', 'trip_id', 'departure_arrival_time'])
    idx = 0
    rows_bkfname = f"{target}_processed_rows_backup.pkl"
    rows = 0
    if (
        os.path.exists(query_table_bkfname) and
        os.path.exists(rows_bkfname)
    ):
        with open(query_table_bkfname, "rb") as f:
            query_table = pickle.load(f)
            idx = len(query_table)
        with open(rows_bkfname, "rb") as f:
            rows = pickle.load(f)
    else:
        print("One or more backup files are missing. Nothing was loaded.")
    return query_table, idx, query_table_bkfname, rows, rows_bkfname

def gen(): 
    query_table, idx, query_table_bkfname, rows, rows_bkfname = init()
    last_record = stop_times.iloc[rows]
    for i, record in stop_times.iloc[rows+1:].iterrows(): 
        if i%1000 == 0: 
            print(i)
        if (last_record['trip_id'] == record['trip_id']): 
            query_table.loc[idx] = [last_record['parent_station'], record['parent_station'], record['trip_id'], (last_record['departure_time'], record['arrival_time'])]
            idx += 1
        last_record = record
        # save
        if i % 20000 == 0 and i > 0:
            print(f"Saving backup at index {i}...")
            with open(query_table_bkfname, "wb") as f:
                pickle.dump(query_table, f)
            with open(rows_bkfname, "wb") as f:
                pickle.dump(i, f)
        # if i == 100: 
        #     break
    query_table = addRouteInfo(query_table)
    query_table = compress(query_table)
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

query_table = gen()
query_table.to_csv(f"../data/preprocessed/{target}/transport_table_updated.csv", index=False)
