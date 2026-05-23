from functools import lru_cache

import searoute as sr


def sea_route(origin: list[float], destination: list[float]) -> dict:
    coordinates, length = _sea_route(
        round(float(origin[0]), 6),
        round(float(origin[1]), 6),
        round(float(destination[0]), 6),
        round(float(destination[1]), 6),
    )
    return {"coordinates": coordinates, "lengthNautical": length}


@lru_cache(maxsize=512)
def _sea_route(origin_lon: float, origin_lat: float, destination_lon: float, destination_lat: float):
    route = sr.searoute(
        [origin_lon, origin_lat],
        [destination_lon, destination_lat],
        units="naut",
    )
    coordinates = route.geometry["coordinates"]
    return coordinates, route.properties.get("length")
