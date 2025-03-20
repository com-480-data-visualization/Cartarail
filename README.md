# Project of Data Visualization (COM-480)

| Student's name | SCIPER |
| -------------- | ------ |
| CHIPLUNKAR Shardul | 353675 |
| GUAN Yawen | 353856 |
| PINAZZA Alexandre | 282395 |

[Milestone 1](#milestone-1) • [Milestone 2](#milestone-2) • [Milestone 3](#milestone-3)

## Milestone 1 (21st March, 5pm)

**10% of the final grade**

This is a preliminary milestone to let you set up goals for your final project and assess the feasibility of your ideas.
Please, fill the following sections about your project.

*(max. 2000 characters per section)*

### Dataset

> Find a dataset (or multiple) that you will explore. Assess the quality of the data it contains and how much preprocessing / data-cleaning it will require before tackling visualization. We recommend using a standard dataset as this course is not about scraping nor data processing.
>
> Hint: some good pointers for finding quality publicly available datasets ([Google dataset search](https://datasetsearch.research.google.com/), [Kaggle](https://www.kaggle.com/datasets), [OpenSwissData](https://opendata.swiss/en/), [SNAP](https://snap.stanford.edu/data/) and [FiveThirtyEight](https://data.fivethirtyeight.com/)), you could use also the DataSets proposed by the ENAC (see the Announcements section on Zulip).

#### Source

We will use the [2025 Switzerland public transport timetable](https://data.opentransportdata.swiss/dataset/timetable-2025-gtfs2020) dataset, published by the SKI office on March 20, 2025 at the [Open Transport Data](https://opentransportdata.swiss/de/) platform.

#### Specification

The timetable dataset is stored in the [General Transit Feed Specification Format (GTFS)](https://gtfs.org/documentation/schedule/reference/). In GTFS terminology, a *route* is a group of trips that share a common branding, such as a train service (e.g., IC 5), and a *trip* is a single instance of a vehicle traveling along a route (e.g., IC 5 travels from Renens VD at 16:41 to Zurich HB at 18:56). 

Specifically, the timetable dataset contains the following 9 sub-datasets: 

- `agency.txt`: Information about transit agencies providing services. 
- `calendar.txt`: Regular service schedules. 
- `calendar_dates.txt`: Exceptions to the regular schedule (e.g., holidays).
- `routes.txt`: Transit routes. 
- `trips.txt`: Trips for each route. 
- `stops.txt`: Locations of stops. 
- `stop_times.txt`: Timetables specifying when trips serve each stop. 
- `transfers.txt`: Rules for making transfers between routes. 
- `feed_info.txt`: Metadata about the dataset. 

#### Data Quality

TBA

### Problematic

> Frame the general topic of your visualization and the main axis that you want to develop.
> - What am I trying to show with my visualization?
> - Think of an overview for the project, your motivation, and the target audience.

#### Motivation

We are used to standard maps where the distance between two locations reflects their physical geographic distance. However, in public transportation, what matters more than physical distance is the ***travel time***. For example, Geneve to Bern (130 km) takes only 2 hours on a direct train, while a shorter route like Lugano to St. Moritz (90 km) takes about 4 hours due to mountainous terrain. What if a map used distance to represent travel time instead of the geographic distance? 

#### Objective: Cartogram of Swiss Public Transport Travel Time

In this project, we are going to explore the concept of a ***cartogram***, a type of thematic map where the size or shape of the geographic regions is distorted to reflect a selected variable. 

We will focus on the travel time within Swizerland's public transport network, that is, the distance between two locations on the map reflects the travel time between them. **The cartogram visualization will shift the perspective from static geography to the real experience of movement through the public transport network.** 

If time permits, we will also explore other interesting variables such as commercial density. 

#### Target Audience

This visualization is designed for both commuters and urban planners:  

- For commuters, our cartogram can assist in planning daily commutes and travel planning; 
- For urban planners, our cartogram can help to better understand how transport infrastructure impacts mobility by highlighting well-connected areas, transit bottlenecks, and disparities in travel efficiency. 

#### Development Plan 

TBA

### Exploratory Data Analysis

> Pre-processing of the data set you chose
> - Show some basic statistics and get insights about the data

TBA

### Related work


> - What others have already done with the data?
> - Why is your approach original?
> - What source of inspiration do you take? Visualizations that you found on other websites or magazines (might be unrelated to your data).
> - In case you are using a dataset that you have already explored in another context (ML or ADA course, semester project...), you are required to share the report of that work to outline the differences with the submission for this class.

TBA.

- [Chronotrains](https://www.chronotrains.com/en)
- [Cartographic Views of the 2024 US Presidential Election](https://worldmapper.org/us-presidential-election-2024/) which contains a cartogram [US Presidential Election 2024 Results](https://worldmapper.org/maps/us-presidential-election-2024-results/)
- Design and Implementation of Travel-time Cartograms.

[1] Wang, L., Ding, L., Krisp, J.M. *et al.* Design and Implementation of Travel-time Cartograms.                    *j. Cartogr. Geogr. inf.* **68**, 13–20 (2018). https://doi.org/10.1007/BF03545340

## Milestone 2 (18th April, 5pm)

**10% of the final grade**


## Milestone 3 (30th May, 5pm)

**80% of the final grade**


## Late policy

- < 24h: 80% of the grade for the milestone
- < 48h: 70% of the grade for the milestone

