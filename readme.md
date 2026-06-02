# Create virtual environment
`python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`

# Generation of data
`.venv/bin/python scripts/generate_listings.py --count 700`