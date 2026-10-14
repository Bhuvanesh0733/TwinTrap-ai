# backend/data/

This directory is a placeholder for cached/exported datasets (e.g. if you export a generated pool to CSV
for offline analysis with `df.to_csv("data/pool.csv")`).

No dataset ships here by default — TwinTrap AI generates its simulated dataset pool in memory on backend
startup (see `README.md` §6 for why no public dataset was bundled instead, and
`backend/app/simulation/dataset_generator.py` for the generator itself).
