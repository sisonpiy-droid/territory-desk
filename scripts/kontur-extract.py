# Offline step: residents per H3 resolution-8 cell from Kontur Population (India, 2023-11-01, CC BY 4.0, via HDX).
# Reads the GeoPackage with Python's built-in sqlite3 and keeps only the cells listed in scripts/out/wanted-cells.txt
# (written by build-geo.js). Writes scripts/out/kontur-cells.tsv: h3 <tab> population.
# Run: python scripts/kontur-extract.py
import sqlite3, os
here = os.path.dirname(os.path.abspath(__file__))
gpkg = os.path.join(here, 'raw', 'kontur_IN_20231101.gpkg')
wanted = set(open(os.path.join(here, 'out', 'wanted-cells.txt')).read().split())
con = sqlite3.connect(gpkg)
table = [r[0] for r in con.execute("select table_name from gpkg_contents where data_type = 'features'")][0]
cols = [r[1] for r in con.execute('pragma table_info("%s")' % table)]
print('table', table, 'columns', cols)
n = kept = 0
with open(os.path.join(here, 'out', 'kontur-cells.tsv'), 'w') as out:
    for h3, pop in con.execute('select h3, population from "%s"' % table):
        n += 1
        if h3 in wanted:
            out.write('%s\t%s\n' % (h3, pop)); kept += 1
print('rows read', n, 'cells kept', kept, 'of', len(wanted), 'wanted')
