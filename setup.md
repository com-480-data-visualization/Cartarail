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

  - Currently, `npm run build` (which will run `tsc && vite build`) does not work because there is top-level await, and vite does not like it and refuses to package the entire website. You can run `tsc` (the typescript compiler), which should work normally and it's happy :) 

- scripts

  - `src/main.ts`: implementation of the dijkstra algorithm. 

- `public`: assets that can be found by the website

  
