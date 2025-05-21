import pandas as pd
import pickle
import os

target = "train"

stations = pd.read_csv(f"../data/preprocessed/{target}/stations.csv");
routes = pd.read_csv(f"../data/preprocessed/{target}/routes.csv");
trips = pd.read_csv(f"../data/preprocessed/{target}/trips.csv");
stop_times = pd.read_csv(f"../data/preprocessed/{target}/stop_times.csv", dtype = {'stop_sequence': int});

def getField(df, xname, x, fname):
    records = df[df[xname] == x]
    if records.empty:
       return ""
    else:
       return records.iloc[0][fname]

def getRouteId(trip_id):
   return getField(trips, 'trip_id', trip_id, 'route_id')

def getRouteInfo(route_id):
   return getField(routes, 'route_id', route_id, ['route_desc', 'route_short_name'])

def init():
    query_table_bkfname = f"{target}_query_table_backup.pkl"
    query_table_idx = 0
    query_table = pd.DataFrame(columns=['start_station', 'next_station', 'route_id', 'route_desc', 'route_short_name', 'departure_arrival_time'])
    processed_rows_bkfname = f"{target}_processed_rows_backup.pkl"
    processed_rows_idx = 0
    if (
        os.path.exists(query_table_bkfname) and
        os.path.exists(processed_rows_bkfname)
    ):
        with open(query_table_bkfname, "rb") as f:
            query_table = pickle.load(f)
            query_table_idx = len(query_table)
        with open(processed_rows_bkfname, "rb") as f:
            processed_rows_idx = pickle.load(f)
    else:
        print("One or more backup files are missing. Nothing was loaded.")
    return query_table, query_table_idx, query_table_bkfname, processed_rows_idx, processed_rows_bkfname

def gen():
    query_table, query_table_idx, query_table_bkfname, processed_rows_idx, processed_rows_bkfname = init()
    for i, record in stop_times.iterrows():
        if i <= processed_rows_idx:
            continue
        print("i = ", i, " query_table_idx = ", query_table_idx)
        # gen
        next_records = stop_times[(stop_times['trip_id'] == record['trip_id']) & (stop_times['stop_sequence'] == record['stop_sequence'] + 1)]
        if next_records.empty:
            continue
        next_record = next_records.iloc[0]
        start_station = record['parent_station']
        next_station = next_record['parent_station']
        route_id = getRouteId(record['trip_id'])
        route_info = getRouteInfo(route_id)
        query_table.loc[query_table_idx] = [start_station, next_station, route_id, route_info['route_desc'], route_info['route_short_name'], (record['departure_time'], next_record['arrival_time'])]
        query_table_idx += 1
        # save
        if i % 100 == 0 and i > 0:
            print(f"Saving backup at index {i}...")
            with open(query_table_bkfname, "wb") as f:
                pickle.dump(query_table, f)
            with open(processed_rows_bkfname, "wb") as f:
                pickle.dump(i, f)
        # if query_table_idx >= 10000:
        #     break
    return compress(query_table)

def compress(query_table):
    merged_df = query_table.groupby(['start_station', 'next_station', 'route_id', 'route_desc', 'route_short_name'], as_index=False).agg({
        'departure_arrival_time': lambda tuples: sorted(set(tuples), key=lambda t: t[0])
    })
    return merged_df

query_table = gen()
query_table.to_csv(f"../data/preprocessed/{target}/transport_table.csv", index=False)
