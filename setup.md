#### get the dataset

1. `wget https://data.opentransportdata.swiss/dataset/6cca1dfb-e53d-4da8-8d49-4797b3e768e3/resource/e3a4012c-8f45-48f9-b5c9-1515a03ee15e/download/gtfs_fp2025_2025-03-20.zip`
2. `unzip gtfs_fp2025_2025-03-20.zip -d gtfs_fp2025_2025-03-20`

#### python notebooks / scripts: 

- `pre-filter.ipynb`: from the original dataset, filters and generates sub-datasets for different targets (train, lausanne, epfl). 
- `get-full-trips.py`: given a target, computes the full trips (all stations that a trip stops by) and stores the info in a csv file. Requires the sub-datasets from `pre-filter.ipynb`.  
- `get-next-stations.py`: given a target, computes all the possible next stations and stores the info in a csv. Requires the full trips data. 

#### www

- setup (built with vite and typescript): 

  - install node.js

  - cd into the `www` directory

  - run `npm install` 

  - run `npm run dev` for development. You will see something like: 

    ```
      VITE v6.2.6  ready in 126 ms
    
      ➜  Local:   http://localhost:5173/
      ➜  Network: use --host to expose
      ➜  press h + enter to show help
    ```

    Open the link in the browser to see the website. Press `F12` and open console, you will see an example trip output (from `main.ts`).

  - run `npm run build` and `npm run deploy` to deploy to github pages.

- scripts

  - `src/path-finder.ts`: implementation of the dijkstra algorithm. 

- `public`: assets that can be found by the website

#### For milestone 2

- data: all stations within 2km from the EPFL metro station (for easy and quick computation)
