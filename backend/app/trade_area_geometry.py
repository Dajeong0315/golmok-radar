"""Match a Kakao place coordinate to the official Seoul trade-area polygons."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

from pyproj import CRS, Transformer
from shapely.geometry import Point, shape
from shapely.geometry.base import BaseGeometry
import shapefile


AREA_RAW_DIR = Path(__file__).resolve().parents[2] / "database" / "raw" / "area"


@dataclass(frozen=True)
class AreaPolygon:
    code: str
    geometry: BaseGeometry


@dataclass(frozen=True)
class AreaLocation:
    code: str | None
    status: str  # inside, nearby, or unmapped
    distance_m: int | None


@lru_cache(maxsize=1)
def load_area_polygons() -> tuple[tuple[AreaPolygon, ...], Transformer]:
    source = next(AREA_RAW_DIR.glob("*.zip"), None)
    if source is None:
        raise FileNotFoundError("Official trade-area boundary data is unavailable.")
    with ZipFile(source) as archive:
        members = {Path(info.filename).suffix.lower(): archive.read(info) for info in archive.infolist()}
    required = {".shp", ".shx", ".dbf", ".prj"}
    if not required.issubset(members):
        raise ValueError("Official trade-area boundary archive is incomplete.")
    coordinate_system = CRS.from_wkt(members[".prj"].decode("ascii"))
    transformer = Transformer.from_crs("EPSG:4326", coordinate_system, always_xy=True)
    reader = shapefile.Reader(
        shp=BytesIO(members[".shp"]),
        shx=BytesIO(members[".shx"]),
        dbf=BytesIO(members[".dbf"]),
        encoding=members.get(".cpg", b"UTF-8").decode("ascii").strip(),
    )
    polygons = tuple(
        AreaPolygon(str(item.record["TRDAR_CD"]), shape(item.shape.__geo_interface__))
        for item in reader.iterShapeRecords()
    )
    return polygons, transformer


def locate_area(latitude: float, longitude: float, nearby_limit_m: int = 500) -> AreaLocation:
    polygons, transformer = load_area_polygons()
    x, y = transformer.transform(longitude, latitude)
    point = Point(x, y)
    inside = [item for item in polygons if item.geometry.covers(point)]
    if inside:
        selected = min(inside, key=lambda item: item.geometry.area)
        return AreaLocation(selected.code, "inside", 0)
    nearest = min(polygons, key=lambda item: item.geometry.distance(point))
    distance = round(nearest.geometry.distance(point))
    if distance <= nearby_limit_m:
        return AreaLocation(nearest.code, "nearby", distance)
    return AreaLocation(None, "unmapped", distance)
