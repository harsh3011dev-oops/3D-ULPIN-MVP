"""
Latency Optimization Benchmark Suite (3D ULPIN AI Pipeline)
===========================================================
Measures satellite tile fetching & pipeline execution latency speedup:
- Uncached sequential downloading vs. Cached multi-threaded parallel downloading
"""

import time
import os
import shutil

try:
    from ai.latency_optimization import download_satellite_tiles_cached, CACHE_DIR
    from ai.utils.image_utils import download_satellite_image
except ModuleNotFoundError:
    from latency_optimization import download_satellite_tiles_cached, CACHE_DIR
    from utils.image_utils import download_satellite_image


def run_latency_benchmark():
    lat, lon = 28.8534, 77.0868
    print("\n" + "=" * 60)
    print(" LATENCY OPTIMIZATION BENCHMARK SUITE")
    print("=" * 60)

    parcel_boundary = {
        "type": "Polygon",
        "coordinates": [[[lon - 0.0005, lat - 0.0005], [lon + 0.0005, lat - 0.0005], [lon + 0.0005, lat + 0.0005], [lon - 0.0005, lat + 0.0005], [lon - 0.0005, lat - 0.0005]]]
    }

    # 1. Measure Baseline (Uncached) Tile Fetch
    if os.path.exists(CACHE_DIR):
        shutil.rmtree(CACHE_DIR)

    t0 = time.time()
    _ = download_satellite_image(parcel_boundary, output_path="exports/benchmark_tile.png", zoom=19)
    t_baseline = (time.time() - t0) * 1000.0
    print(f"1. Baseline Tile Download (Uncached Single-Thread): {t_baseline:.2f} ms")

    # 2. Measure Parallel Threaded Fetch (First Cold Run)
    if os.path.exists(CACHE_DIR):
        shutil.rmtree(CACHE_DIR)

    t0 = time.time()
    img_parallel = download_satellite_tiles_cached(lat, lon, zoom=19)
    t_parallel_cold = (time.time() - t0) * 1000.0
    print(f"2. Multi-Thread Parallel Fetch (Cold Cache):       {t_parallel_cold:.2f} ms")

    # 3. Measure Warm Cache Hit Fetch
    t0 = time.time()
    img_cached = download_satellite_tiles_cached(lat, lon, zoom=19)
    t_parallel_warm = (time.time() - t0) * 1000.0
    print(f"3. Persistent Disk Cache Hit (Warm Cache):          {t_parallel_warm:.2f} ms")

    print("-" * 60)
    speedup_cold = ((t_baseline - t_parallel_cold) / t_baseline) * 100.0
    speedup_warm = ((t_baseline - t_parallel_warm) / t_baseline) * 100.0
    print(f"Cold Cache Speedup: {speedup_cold:+.1f}%")
    print(f"Warm Cache Speedup: {speedup_warm:+.1f}%")
    print("=" * 60 + "\n")

    return {
        "baseline_ms": round(t_baseline, 2),
        "parallel_cold_ms": round(t_parallel_cold, 2),
        "parallel_warm_ms": round(t_parallel_warm, 2),
        "cold_speedup_percent": round(speedup_cold, 2),
        "warm_speedup_percent": round(speedup_warm, 2)
    }


if __name__ == "__main__":
    run_latency_benchmark()
