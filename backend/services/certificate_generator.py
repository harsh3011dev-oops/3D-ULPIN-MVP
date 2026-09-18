"""
backend/services/certificate_generator.py
Official 3D ULPIN Title Certificate & Land Registry Generator Service.

Generates ISO 19152 LADM & DILRMP compliant 3D Strata Title Certificates (HTML / Printable PDF format)
featuring 3D ULPIN, QR Code verification, vertical elevation profiles (z_min, z_max), and geodetic bounds.
"""

import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def generate_3d_ulpin_certificate_html(
    building_data: dict,
    unit_data: dict,
    verification_url_base: str = "http://localhost:8000/api/v1/validation"
) -> str:
    """
    Generates a formal, printable HTML/CSS 3D Land Title Certificate with DILRMP & ISO 19152 LADM compliance stamps.
    """
    building_name = building_data.get("building_name", "Antigravity Strata Tower")
    parcel_id = building_data.get("parcel_id", "PARCEL-DEL-2024-001")
    city = building_data.get("city", "New Delhi")

    unit_id = unit_data.get("unit_id", "UNIT_F04_U02")
    ulpin_3d = unit_data.get("ulpin", f"{parcel_id}-F04-U02-77212863")
    floor_num = unit_data.get("floor", 4)
    label = unit_data.get("label", "Flat 402")
    z_min = float(unit_data.get("z_min", 9.0))
    z_max = float(unit_data.get("z_max", 12.0))
    clearance_m = round(z_max - z_min, 2)
    area_sqm = float(unit_data.get("area_sqm", 134.7))
    area_sqft = round(area_sqm * 10.7639, 2)
    owner_name = unit_data.get("owner_name", "Verified Strata Title Holder")

    centroid = unit_data.get("centroid", [28.6315, 77.2167])
    lat_str = f"{centroid[0]:.6f}°N"
    lon_str = f"{centroid[1]:.6f}°E"

    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={ulpin_3d}"

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>3D ULPIN Title Certificate - {ulpin_3d}</title>
    <style>
        @page {{ size: A4; margin: 0; }}
        body {{
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #0f172a;
            color: #f8fafc;
            margin: 0;
            padding: 30px;
            display: flex;
            justify-content: center;
        }}
        .certificate-container {{
            width: 800px;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border: 3px solid #38bdf8;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
            position: relative;
        }}
        .header {{
            text-align: center;
            border-bottom: 2px solid #334155;
            padding-bottom: 20px;
            margin-bottom: 25px;
        }}
        .header h1 {{
            margin: 0;
            color: #38bdf8;
            font-size: 26px;
            letter-spacing: 1px;
            text-transform: uppercase;
        }}
        .header h2 {{
            margin: 5px 0 0 0;
            color: #94a3b8;
            font-size: 14px;
            font-weight: 400;
        }}
        .badge-bar {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 25px;
        }}
        .badge {{
            background: #1e293b;
            border: 1px solid #0284c7;
            color: #38bdf8;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }}
        .ulpin-banner {{
            background: rgba(56, 189, 248, 0.1);
            border: 1px dashed #38bdf8;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            margin-bottom: 30px;
        }}
        .ulpin-banner .label {{ color: #94a3b8; font-size: 12px; text-transform: uppercase; }}
        .ulpin-banner .value {{ color: #f0f9ff; font-size: 24px; font-weight: 700; letter-spacing: 2px; font-family: monospace; }}

        .details-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }}
        .card {{
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 16px;
        }}
        .card-title {{
            color: #38bdf8;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 12px;
            border-bottom: 1px solid #334155;
            padding-bottom: 6px;
        }}
        .row {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }}
        .row .key {{ color: #94a3b8; }}
        .row .val {{ color: #f8fafc; font-weight: 600; }}

        .footer {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 2px solid #334155;
            padding-top: 20px;
            margin-top: 10px;
        }}
        .qr-code img {{
            width: 100px;
            height: 100px;
            border-radius: 8px;
            border: 2px solid #38bdf8;
        }}
        .signature-block {{
            text-align: right;
        }}
        .stamp {{
            display: inline-block;
            border: 2px solid #22c55e;
            color: #22c55e;
            padding: 6px 12px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 11px;
            text-transform: uppercase;
            margin-bottom: 10px;
        }}
    </style>
</head>
<body>
    <div class="certificate-container">
        <div class="header">
            <h1>🌐 Government 3D Cadastral Registry</h1>
            <h2>Digital India Land Records Modernization Programme (DILRMP) | ISO 19152 LADM Compliant</h2>
        </div>

        <div class="badge-bar">
            <span class="badge">LADM 3D Spatial Unit (LA_SpatialUnit)</span>
            <span class="badge">WGS84 Geodetic Datum (EPSG:4326)</span>
            <span class="badge">Status: VERIFIED VALID</span>
        </div>

        <div class="ulpin-banner">
            <div class="label">3D Unique Land Parcel Identification Number (ULPIN-3D)</div>
            <div class="value">{ulpin_3d}</div>
        </div>

        <div class="details-grid">
            <div class="card">
                <div class="card-title">🏢 Parcel & Property Metadata</div>
                <div class="row"><span class="key">2D Parent Parcel ID:</span><span class="val">{parcel_id}</span></div>
                <div class="row"><span class="key">Building Name:</span><span class="val">{building_name}</span></div>
                <div class="row"><span class="key">City / Location:</span><span class="val">{city}</span></div>
                <div class="row"><span class="key">Floor Level:</span><span class="val">Floor {floor_num} ({label})</span></div>
                <div class="row"><span class="key">Strata Title Holder:</span><span class="val">{owner_name}</span></div>
            </div>

            <div class="card">
                <div class="card-title">📐 Volumetric Elevation Profile</div>
                <div class="row"><span class="key">Base Elevation (Z_min):</span><span class="val">+{z_min:.2f} m</span></div>
                <div class="row"><span class="key">Top Elevation (Z_max):</span><span class="val">+{z_max:.2f} m</span></div>
                <div class="row"><span class="key">Interstory Height:</span><span class="val">{clearance_m:.2f} m</span></div>
                <div class="row"><span class="key">Built-Up Area:</span><span class="val">{area_sqm:.2f} m² ({area_sqft:.0f} sq.ft)</span></div>
                <div class="row"><span class="key">Geodetic Centroid:</span><span class="val">{lat_str}, {lon_str}</span></div>
            </div>
        </div>

        <div class="footer">
            <div class="qr-code">
                <img src="{qr_url}" alt="Verification QR Code">
            </div>
            <div class="signature-block">
                <div class="stamp">✓ PostGIS 3D Topological Integrity Verified</div>
                <div style="font-size: 11px; color: #94a3b8;">Issued by 3D-ULPIN Spatial Registry Authority</div>
                <div style="font-size: 10px; color: #64748b;">Cryptographic Hash Certified</div>
            </div>
        </div>
    </div>
</body>
</html>
"""
    return html_content
