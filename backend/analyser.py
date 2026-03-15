"""
Case Intelligence Backend — analyser.py
Ports the frontend classification + aggregation engine to Python.
"""

from __future__ import annotations

import io
import re
import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import pandas as pd

# ─────────────────────────────────────────────────────────────────
# TAXONOMY
# ─────────────────────────────────────────────────────────────────

TAXONOMY: list[dict] = [
    {
        "id": "load_ref",
        "label": "Missing Load Reference",
        "keywords": [
            "load ref", "loadref", "load reference", "without reference", "no reference",
            "ref missing", "booking ref", "booking number", "without booking", "reference number",
            "load number", "without load", "no load ref", "missing reference",
            "no ref", "ref not provided", "ref number missing", "ref number not", "no booking number",
            "reference not found", "reference not provided", "without load number", "load ref not",
            "order reference", "order number missing", "po number missing", "po number not",
            "purchase order missing", "without po", "shipment reference", "shipment ref",
            "consignment number missing", "no consignment ref", "job reference", "job number missing",
        ],
        "hours": 0.5,
        "preventable": True,
        "color": "#dc6d7d",
    },
    {
        "id": "transport_order",
        "label": "Transport Order",
        "keywords": [
            "transport order", "transport instruction", "haulier order", "haulier instruction",
            "transport booking order", "driver order", "driver instruction",
            "missing transport order", "transport order missing", "transport order not received",
            "transport order required", "no transport order", "tro",
        ],
        "hours": 0.5,
        "preventable": True,
        "color": "#8b7cff",
    },
    {
        "id": "customs",
        "label": "Customs / Documentation",
        "keywords": [
            "customs", "douane", "zoll", "declaration", "mrn", "eur1", "certificate of origin",
            "coo", "phytosanitary", "health cert", "import license", "export license",
            "commercial invoice", "customs clearance", "customs hold", "customs inspection",
            "import declaration", "export declaration", "customs duty",
            "hs code", "tariff code", "commodity code", "eori", "eori number", "vat number",
            "duty", "import duty", "export duty", "customs broker", "clearing agent",
            "customs agent", "customs release", "customs exam", "customs delay", "customs check",
            "ata carnet", "carnet", "bonded warehouse", "bonded goods", "customs entry",
            "customs value", "customs documents", "customs paperwork", "missing documents",
            "documentation missing", "documents not received", "documents missing",
            "invoice missing", "packing list", "packing list missing", "certificate missing",
            "compliance documents", "regulatory documents", "import compliance",
            "export compliance", "sanctions", "restricted goods", "prohibited goods",
            "customs rejection", "customs refusal", "customs error", "customs query",
        ],
        "hours": 1.5,
        "preventable": True,
        "color": "#d8a34c",
    },
    {
        "id": "portbase",
        "label": "Portbase / Port Notification",
        "keywords": [
            "portbase", "port notification", "port clearance", "pre-notification",
            "port system", "pcs message", "ata notification", "atd notification",
            "pre arrival", "port entry", "terminal notification",
            "port authority", "harbour authority", "port entry rejected", "port access",
            "terminal access", "gate notification", "port pre-arrival", "vessel notification",
            "shipping notification", "port message", "port admin", "port documentation",
            "pre-arrival notification", "arrival notification", "departure notification",
            "port registration", "port permit", "berth notification", "pilot notification",
        ],
        "hours": 0.75,
        "preventable": True,
        "color": "#7aa2ff",
    },
    {
        "id": "bl",
        "label": "Bill of Lading (B/L)",
        "keywords": [
            "bill of lading", "b/l", "sea waybill", "original bl", "telex release",
            "surrender bl", "express bl", "lading", "bl correction", "bl amendment",
            "release of bl", "bl not received", "bl missing",
            "hbl", "mbl", "house bl", "master bl", "house bill", "master bill",
            "bl release", "bl not available", "bl draft", "bl copy", "bl original",
            "waybill", "air waybill", "awb", "consignment note", "cmr", "cmr note",
            "bl error", "bl incorrect", "bl discrepancy", "bl dispute", "bl query",
            "shipping document", "shipping release", "cargo release", "cargo documents",
            "original documents", "original required", "original not received",
        ],
        "hours": 1.0,
        "preventable": False,
        "color": "#52c7c7",
    },
    {
        "id": "t1",
        "label": "T1 / Transit Document",
        "keywords": [
            "t1 document", "transit document", "community transit", "transit declaration",
            "transit entry", "t1 missing", "t1 error", "t1 correction", "transit pass",
            "t1", "t2", "transit procedure", "transit customs", "transit mrn",
            "common transit", "ncts", "new computerised transit system", "transit guarantee",
            "transit release", "transit document missing", "t1 form", "t1 form missing",
            "movement certificate", "ec1 form", "transit form", "transit certificate",
            "customs transit", "eu transit", "intra eu transit", "transit document required",
            "please provide t1", "send t1", "t1 required", "t1 needed", "t1 absent",
        ],
        "hours": 1.2,
        "preventable": True,
        "color": "#f5b767",
    },
    {
        "id": "delay",
        "label": "Delay / Not On Time",
        "keywords": [
            "delay", "delayed", "not on time", "late arrival", "missed eta", "overdue",
            "behind schedule", "slow delivery", "not in time", "running late",
            "eta missed", "eta not", "eta breached", "expected time of arrival",
            "off-schedule", "off schedule", "late collection", "collection delay",
            "late delivery", "delivery delay", "late dispatch", "dispatch delay",
            "behind", "delay in", "delayed in", "not delivered on time",
            "past deadline", "deadline missed", "late train",
            "missed slot", "slot missed", "late to rail", "rail cut missed",
            "barge cut missed", "vessel cut missed", "cut-off missed", "cutoff missed",
            "not timely", "untimely", "overdue shipment", "deferred", "postponed",
            # Additional high-coverage phrases
            "not arrived", "hasn't arrived", "have not arrived", "still not here",
            "driver no show", "no show", "driver not shown", "truck not arrived",
            "vehicle not arrived", "still waiting for", "still at", "stuck at",
            "not yet arrived", "not yet picked", "not yet collected", "not yet delivered",
            "expected yesterday", "expected today", "expected this morning",
            "originally due", "was due", "was supposed to", "should have arrived",
            "shipment late", "consignment late", "delivery overdue",
        ],
        "hours": 2.0,
        "preventable": False,
        "color": "#f56b6b",
    },
    {
        "id": "damage",
        "label": "Damage / Loss / Claim",
        "keywords": [
            "damage", "damaged", "loss", "lost", "destroyed", "broken", "defective",
            "claim", "insurance claim", "shortage", "cargo damage", "goods damage",
            "container damage", "equipment damage", "vehicle damage", "truck damage",
            "harm", "destruction", "casualty", "accident", "incident", "broken goods",
            "missing item", "missing items", "missing product", "loss of cargo", "cargo loss",
            "shortage claim", "damaged shipment", "damage report", "loss report",
            "pilferage", "theft", "theft claim", "claim filed", "claim pending",
            "claims procedure", "cargo claim", "damage assessment", "insurance report",
        ],
        "hours": 3.0,
        "preventable": False,
        "color": "#e85c4c",
    },
    {
        "id": "closing_time",
        "label": "Terminal / Vessel Cutoff",
        "keywords": [
            "closing time", "cutoff", "cut off", "cut-off", "rail cut", "rail cutoff",
            "rail cut-off", "barge cut", "barge cutoff", "barge cut-off", "vessel cut",
            "vessel cutoff", "vessel cut-off", "gate closing", "gate close", "terminal close",
            "terminal closing", "container return deadline", "container deadline",
            "drop-off deadline", "loading deadline", "manifest deadline",
            "deadline approaching", "deadline passed", "deadline missed", "deadline breach",
            "closing time passed", "too late for", "missed cutoff", "missed cut-off",
        ],
        "hours": 1.5,
        "preventable": True,
        "color": "#c98b4e",
    },
    {
        "id": "amendment",
        "label": "Amendment / Correction / Update",
        "keywords": [
            "amendment", "amend", "amended", "correction", "correct", "corrected",
            "update", "updated", "change", "changed", "revision", "revised", "modification",
            "modify", "modified", "adjust", "adjustment", "alter", "altered", "rectify",
            "rectified", "please correct", "please update", "please change", "please amend",
            "need to correct", "need to update", "must correct", "must update",
            "booking amendment", "booking correction", "order amendment", "order correction",
            "shipment amendment", "shipment correction", "cancel and rebook", "rebook",
            # High-coverage additions
            "wrong address", "incorrect address", "address correction", "new address",
            "updated address", "address has changed", "address change",
            "wrong name", "incorrect name", "name correction", "name change",
            "wrong container", "incorrect container", "container change",
            "wrong weight", "incorrect weight", "weight correction",
            "wrong date", "incorrect date", "date change", "date correction",
            "mistake in", "error in", "incorrect details", "wrong details",
            "details need to be", "needs updating", "need to be corrected",
            "please note the change", "please note the update",
            "we have updated", "we have amended", "we have changed",
            "as discussed we need to", "kindly amend", "kindly correct",
        ],
        "hours": 0.75,
        "preventable": True,
        "color": "#4ec9c9",
    },
    {
        "id": "waiting_time",
        "label": "Waiting Time / Demurrage / Detention",
        "keywords": [
            "waiting time", "waiting times", "waiting costs", "demurrage", "detention",
            "detention charges", "storage charges", "storage costs", "lay time", "laytime",
            "waiting charge", "waiting fee", "idle charge", "idle time charge",
            "equipment waiting", "container waiting", "truck waiting", "driver waiting",
            "driver idle", "equipment idle", "demurrage charges", "detention charges",
            "wharfage", "terminal charges", "port charges", "berth waiting",
        ],
        "hours": 1.5,
        "preventable": True,
        "color": "#7e5ea8",
    },
    {
        "id": "rate",
        "label": "Invoice / Rate / Charge / Billing",
        "keywords": [
            "rate", "invoice", "billing", "charge", "charges", "cost", "costs", "fee", "fees",
            "surcharge", "extra charge", "additional charge", "fuel surcharge",
            "rate issue", "rate discussion", "rate query", "rate quote", "rate confirmation",
            "freight rate", "base rate", "emergency surcharge",
            "invoice error", "invoice issue", "invoice query", "invoice dispute",
            "invoice incorrect", "overcharge", "overcharged", "billing error", "billing dispute",
            "credit note", "debit note", "refund", "price", "pricing", "cost allocation",
        ],
        "hours": 1.0,
        "preventable": False,
        "color": "#6ba589",
    },
    {
        "id": "equipment",
        "label": "Container / Equipment Issue",
        "keywords": [
            "equipment issue", "container issue", "equipment problem", "container problem",
            "equipment defect", "equipment damage", "portable defect",
            "equipment not ok", "equipment nok", "equipment defective",
            "container not released", "equipment not released",
            "defective equipment", "damaged equipment", "broken equipment", "faulty equipment",
            "equipment shortage", "container shortage", "portable shortage",
            "equipment recall", "reefer", "reefer issue",
            "equipment dirty", "equipment unclean", "equipment cleaning",
        ],
        "hours": 2.0,
        "preventable": True,
        "color": "#d4a574",
    },
    {
        "id": "tracking",
        "label": "Tracking / Visibility / Status",
        "keywords": [
            "tracking", "visibility", "where is", "where's", "current location", "current status",
            "shipment status", "delivery status", "container status",
            "track and trace", "status update", "status query", "status check",
            "please advise status", "what is status", "advise location", "advise status",
            "advise eta", "advise arrival", "advise departure",
            # High-coverage additions
            "eta", "atd", "ata", "proof of delivery", "pod", "delivery proof",
            "where is my", "where is the", "where are the", "where are my",
            "what is the status", "what is the current", "what is the latest",
            "any update on", "update on the", "please update us",
            "can you advise", "can you confirm", "can you check",
            "has it arrived", "has it been delivered", "has it departed",
            "confirm arrival", "confirm delivery", "confirm receipt",
            "estimated delivery", "estimated arrival", "expected delivery",
            "live tracking", "live status", "real-time",
            "last known", "last update", "last event", "last milestone",
        ],
        "hours": 0.5,
        "preventable": True,
        "color": "#8bb98c",
    },
    {
        "id": "communication",
        "label": "Communication / Escalation / Complaint",
        "keywords": [
            "escalation", "escalated", "escalate", "complaint", "complain",
            "urgent", "very urgent", "extremely urgent", "urgent attention",
            "unacceptable", "unacceptable service", "unacceptable performance",
            "service failure", "service complaint", "customer complaint",
            "dissatisfied", "dissatisfaction", "disappointed", "frustration", "frustrated",
            "serious issue", "serious problem", "serious concern",
            "please help", "please assist", "need assistance", "need help",
            "critical issue", "critical problem",
            # High-coverage additions
            "chasing", "following up", "follow up", "follow-up",
            "no reply", "no response", "unanswered", "not responded",
            "second reminder", "third reminder", "reminder",
            "as per my previous email", "as per my email", "as per my last",
            "did you receive my", "have you received my",
            "awaiting your response", "awaiting your reply",
            "please respond", "please reply asap", "please reply urgently",
            "this is unacceptable", "this is not acceptable", "not good enough",
            "poor service", "poor communication", "lack of communication",
            "we are very disappointed", "deeply disappointed",
            "management attention", "raise this formally", "formal complaint",
        ],
        "hours": 0.75,
        "preventable": True,
        "color": "#d97979",
    },
    {
        "id": "equipment_release",
        "label": "Equipment Release / Acceptance",
        "keywords": [
            "release pin", "pin release", "release order", "delivery order",
            "equipment release", "container release", "chassis release",
            "release at", "release by", "release date", "release time",
            "please release", "request release", "requesting release", "release pending",
            "release approved", "release confirmed", "equipment acceptance",
        ],
        "hours": 1.0,
        "preventable": True,
        "color": "#5fa8b5",
    },
    {
        "id": "capacity",
        "label": "Capacity / Feasibility",
        "keywords": [
            "capacity", "capacity request", "feasibility", "feasibility check",
            "available capacity", "available slot", "availability",
            "do you have capacity", "have capacity", "is it possible", "can load",
            "can transport", "can book", "slot availability", "slot request",
            "intermodal feasibility", "transport feasibility", "booking feasibility",
            "preferred date", "loading window", "slot allocation", "confirm slot",
            "confirm availability",
        ],
        "hours": 0.5,
        "preventable": True,
        "color": "#c9a37e",
    },
    {
        "id": "pickup_delivery",
        "label": "Pickup / Delivery Planning",
        "keywords": [
            "pickup", "pick up", "pick-up", "delivery", "collect", "collection", "drop-off",
            "arrange pickup", "arrange delivery", "arrange collection",
            "schedule pickup", "schedule delivery", "schedule collection",
            "pickup time", "delivery time", "collection time",
            "pickup date", "delivery date", "collection date",
            "pickup address", "delivery address", "loading location", "unloading location",
            "ready for pickup", "ready for delivery",
        ],
        "hours": 1.0,
        "preventable": True,
        "color": "#a8c95e",
    },
    {
        "id": "scheduling",
        "label": "Scheduling / Slot / Appointment",
        "keywords": [
            "schedule", "scheduled", "scheduling", "slot", "slots", "appointment",
            "time slot", "rail cut", "barge cut", "vessel cut", "gate time",
            "gate opening", "gate close", "closing time", "cutoff time",
            "confirm time", "confirm date", "confirm slot", "confirm appointment",
            "book slot", "request slot", "request appointment", "reserve slot",
            "reschedule", "change schedule", "change time", "change date", "move slot",
        ],
        "hours": 0.75,
        "preventable": True,
        "color": "#9b9b7e",
    },
    {
        "id": "vgm",
        "label": "VGM / Weight Note / Tare Weight",
        "keywords": [
            "vgm", "verified gross mass", "gross mass", "weight note",
            "weighing certificate", "weighing cert", "weight certificate",
            "vgm required", "vgm declaration", "vgm submission", "vgm deadline", "vgm missing",
            "vgm not received", "vgm pending",
            "please provide weight", "please send weight", "please submit vgm",
            "tare certificate", "tare note", "shipper certified weight",
        ],
        "hours": 0.75,
        "preventable": True,
        "color": "#c9b37e",
    },
    {
        "id": "seal",
        "label": "Seal / Container Details",
        "keywords": [
            "seal number", "seal missing", "seal broken", "seal damage",
            "seal check", "seal verified", "seal verification", "seal integrity",
            "seal required", "seal provided", "container details", "container info",
            "container size", "container type", "20ft", "40ft", "40hc",
            "seal discrepancy", "seal issue", "seal problem",
        ],
        "hours": 0.75,
        "preventable": True,
        "color": "#b5a87e",
    },
    {
        "id": "dangerous_goods",
        "label": "Dangerous Goods / IMO / ADR",
        "keywords": [
            "dangerous goods", "imo", "imo class", "imo clause", "hazmat", "hazardous",
            "hazardous material", "hazardous goods", "adr", "adr class", "adr compliant",
            "un number", "un class", "proper shipping name", "psn",
            "dangerous goods declaration", "dangerous goods form", "dg certificate",
            "dg manifest", "dg documentation", "dg document",
            "prohibited goods", "restricted goods", "controlled substance",
        ],
        "hours": 2.0,
        "preventable": True,
        "color": "#d9594c",
    },
    {
        "id": "shipping_advice",
        "label": "Shipping Advice / Status Notice",
        "keywords": [
            "shipping advice", "packing list", "shipping notice", "shipping instruction",
            "advanced shipping notice", "asn", "dispatch advice",
            "shipment notice", "shipment notification", "loading advice", "loading plan",
            "loading instruction", "booking confirmation", "booking advice",
            "delivery advice", "receiving advice", "goodsreturn", "goods notice",
            "shipping manifest", "cargo manifest",
        ],
        "hours": 0.5,
        "preventable": True,
        "color": "#8bb9c9",
    },
    {
        "id": "ref_provided",
        "label": "Reference Update / Info Provided",
        "keywords": [],
        "hours": 0.25,
        "preventable": False,
        "color": "#6fc3a0",
    },
    {
        "id": "other",
        "label": "Other / Unclassified",
        "keywords": [],
        "hours": 0.5,
        "preventable": False,
        "color": "#6b7280",
    },
]

TAXONOMY_MAP: dict[str, dict] = {item["id"]: item for item in TAXONOMY}

REVIEW_FLAG_THRESHOLD = 0.60  # confidence below this triggers review

# Maps each issue_id → human-readable description of the detected operational object.
# Mirrors DETECTED_OBJECT_MAP in src/lib/intentDetection.ts.
DETECTED_OBJECT_MAP: dict[str, str] = {
    'load_ref':          'Load / Booking Reference',
    'ref_provided':      'Load / Booking Reference',
    'transport_order':   'Transport Order / TRO',
    'customs':           'Customs / Compliance Document',
    'portbase':          'Portbase / Port Notification',
    'bl':                'Bill of Lading (B/L)',
    't1':                'T1 / Transit Document',
    'delay':             'Shipment / Delivery',
    'closing_time':      'Terminal / Vessel Cutoff',
    'amendment':         'Booking / Order Details',
    'waiting_time':      'Waiting Time / Demurrage Charge',
    'rate':              'Invoice / Rate / Charge',
    'damage':            'Cargo / Goods',
    'equipment':         'Container / Equipment',
    'tracking':          'Shipment Status / Visibility',
    'communication':     'Service / Escalation',
    'equipment_release': 'Release Pin / Delivery Order',
    'scheduling':        'Slot / Appointment',
    'pickup_delivery':   'Pickup / Delivery Planning',
    'capacity':          'Capacity / Availability',
    'shipping_advice':   'Shipping Advice / Status Notice',
    'vgm':               'VGM / Weight Certificate',
    'seal':              'Seal Number / Container Seal',
    'dangerous_goods':   'Dangerous Goods / IMO / ADR Declaration',
    'other':             'Unclassified',
}

# ─────────────────────────────────────────────────────────────────
# CATEGORY → ISSUE DIRECT MAPPING
# When the Excel Category/Type column clearly names the issue, map it
# directly — bypasses keyword scoring for much higher accuracy.
# ─────────────────────────────────────────────────────────────────
CATEGORY_MAP: dict[str, str] = {
    # Delay
    "delay": "delay", "delayed": "delay", "late": "delay", "not on time": "delay",
    "delay / not on time": "delay", "transport delay": "delay", "delivery delay": "delay",
    # Load ref
    "load ref": "load_ref", "load reference": "load_ref", "missing load ref": "load_ref",
    "missing load reference": "load_ref", "reference missing": "load_ref",
    # Customs
    "customs": "customs", "customs / documentation": "customs", "documentation": "customs",
    "customs clearance": "customs", "customs documentation": "customs", "customs query": "customs",
    # Amendment
    "amendment": "amendment", "correction": "amendment", "booking amendment": "amendment",
    "modification": "amendment", "update": "amendment", "change": "amendment",
    # Damage
    "damage": "damage", "claim": "damage", "cargo damage": "damage", "loss": "damage",
    "cargo claim": "damage", "shortage": "damage",
    # Waiting time
    "waiting time": "waiting_time", "demurrage": "waiting_time", "detention": "waiting_time",
    "storage": "waiting_time",
    # Tracking
    "tracking": "tracking", "visibility": "tracking", "status": "tracking",
    "status update": "tracking", "tracking / visibility": "tracking", "pod": "tracking",
    "proof of delivery": "tracking", "eta": "tracking",
    # B/L
    "bill of lading": "bl", "b/l": "bl", "bl": "bl", "bl issue": "bl",
    "original bl": "bl", "bl amendment": "bl", "telex release": "bl",
    # T1
    "t1": "t1", "transit document": "t1", "transit": "t1", "t1 document": "t1",
    # Equipment
    "equipment": "equipment", "container issue": "equipment", "equipment issue": "equipment",
    "reefer": "equipment", "equipment defect": "equipment",
    # Equipment release
    "release": "equipment_release", "equipment release": "equipment_release",
    "pin release": "equipment_release", "delivery order": "equipment_release",
    "container release": "equipment_release",
    # Transport order
    "transport order": "transport_order", "haulier order": "transport_order", "tro": "transport_order",
    "transport instruction": "transport_order",
    # Portbase
    "portbase": "portbase", "port notification": "portbase", "port pre-arrival": "portbase",
    "port pre arrival": "portbase",
    # Rate / invoice
    "rate": "rate", "invoice": "rate", "billing": "rate", "charge": "rate",
    "surcharge": "rate", "overcharge": "rate", "pricing": "rate", "freight rate": "rate",
    # Capacity
    "capacity": "capacity", "feasibility": "capacity", "availability": "capacity",
    "capacity request": "capacity",
    # Pickup / delivery
    "pickup": "pickup_delivery", "delivery": "pickup_delivery", "collection": "pickup_delivery",
    "pick up": "pickup_delivery", "delivery planning": "pickup_delivery",
    "pick-up": "pickup_delivery",
    # Scheduling
    "scheduling": "scheduling", "appointment": "scheduling", "slot": "scheduling",
    "slot booking": "scheduling",
    # VGM
    "vgm": "vgm", "weight": "vgm", "weight note": "vgm", "verified gross mass": "vgm",
    # Dangerous goods
    "dangerous goods": "dangerous_goods", "hazmat": "dangerous_goods",
    "dg": "dangerous_goods", "imo": "dangerous_goods", "adr": "dangerous_goods",
    # Communication
    "complaint": "communication", "escalation": "communication",
    "escalate": "communication", "communication": "communication",
    # Shipping advice
    "shipping advice": "shipping_advice", "booking confirmation": "shipping_advice",
    "pre-alert": "shipping_advice", "pre alert": "shipping_advice", "asn": "shipping_advice",
    "notification": "shipping_advice", "advice": "shipping_advice",
    # Closing time / cutoff
    "closing time": "closing_time", "cutoff": "closing_time", "cut-off": "closing_time",
    "vessel cut": "closing_time", "rail cut": "closing_time", "barge cut": "closing_time",
    # Seal
    "seal": "seal", "seal issue": "seal",
}

# ─────────────────────────────────────────────────────────────────
# RECOVERY SIGNALS
# Broad short-phrase fallback used ONLY when keyword scoring returns
# "other". Ordered by specificity (most specific first).
# ─────────────────────────────────────────────────────────────────
RECOVERY_SIGNALS: list[tuple[list[str], str]] = [
    # Delay / no-show
    (["not arrived", "no show", "still waiting", "driver not arrived", "driver hasn't",
      "truck not arrived", "vehicle not arrived", "hasn't been collected", "hasn't arrived",
      "not yet delivered", "not yet collected", "not yet received", "not yet picked up",
      "still not here", "still at origin", "past due", "overdue"], "delay"),
    # Tracking / status
    (["where is", "where are", "what is the status", "what's the status", "status of",
      "update on", "any news", "any update", "please update", "advise on",
      "can you advise", "proof of delivery", "pod request", "confirm arrival",
      "confirm delivery", "confirm receipt", "has it arrived", "has it been delivered",
      "estimated arrival", "when will it arrive", "when will the delivery"], "tracking"),
    # Amendment / correction
    (["wrong address", "incorrect address", "address correction", "address change",
      "wrong name", "incorrect name", "name correction", "please change the",
      "needs to be updated", "needs to be corrected", "correction needed",
      "please update the", "wrong details", "incorrect details",
      "mistake in", "wrong date", "incorrect date", "error in booking"], "amendment"),
    # Communication / escalation
    (["chasing", "following up", "follow-up", "no reply", "no response", "unanswered",
      "third reminder", "second reminder", "first reminder", "as per my previous",
      "as per my email", "did you receive", "have you received my",
      "awaiting your response", "please respond", "please reply", "urgent reminder",
      "reminder email", "this is a reminder"], "communication"),
    # Equipment release
    (["release code", "release pin", "pin code", "container pin", "vbs pin",
      "require pin", "need pin", "pin for", "pin number", "release number",
      "collect container", "container collection", "pickup container",
      "terminal release", "port release", "collect at terminal"], "equipment_release"),
    # Scheduling / timing
    (["what time will", "confirm time", "delivery window", "morning delivery",
      "afternoon delivery", "morning slot", "afternoon slot",
      "arrival window", "loading time", "unloading time", "departure time",
      "what day will", "which day will"], "scheduling"),
    # Pickup / delivery arrangement
    (["please arrange", "please organise", "please organize", "need to arrange",
      "requires delivery to", "need delivery to", "please book transport",
      "arrange collection from", "arrange delivery to",
      "requesting transport", "book transport", "organize transport"], "pickup_delivery"),
    # Rate / billing
    (["quoted rate", "agreed rate", "contract rate", "spot rate",
      "please invoice", "invoice attached", "payment due", "outstanding invoice",
      "disputed invoice", "invoice query"], "rate"),
    # Customs clearance
    (["held at customs", "at customs", "cleared customs", "customs examination",
      "under examination", "awaiting customs release", "customs hold",
      "released from customs", "customs entry number", "awaiting clearance"], "customs"),
    # B/L related
    (["release cargo", "cargo release", "release shipment", "surrender bl",
      "telex release", "cargo documents required", "original documents required",
      "draft bl", "bl draft"], "bl"),
    # Damage / shortage
    (["goods were damaged", "arrived damaged", "items missing", "goods missing",
      "short delivery", "short shipment", "partial delivery",
      "not all items received", "goods not received", "incorrect quantity"], "damage"),
    # Capacity / feasibility
    (["is it possible to", "can you do", "can you handle", "is there capacity",
      "is it feasible", "do you have space", "slot available", "is there a slot",
      "can this be loaded"], "capacity"),
    # Closing time / cutoff
    (["what is the cutoff", "what is the closing", "when is the cutoff",
      "when is the closing", "gate closes at", "gate opening time", "gate close time"], "closing_time"),
    # Seal
    (["seal no.", "seal nr", "container seal", "seal intact", "seal broken",
      "seal ok", "seal check", "seal discrepancy"], "seal"),
    # Dangerous goods
    (["un number", "dg class", "imo class", "hazardous material", "dangerous cargo",
      "dg cargo", "imdg", "dg document", "dangerous goods form",
      "un no", "adnr", "regulated goods"], "dangerous_goods"),
    # VGM / weight
    (["gross weight", "gross mass", "total weight", "weight declaration",
      "vgm declaration", "weighing slip", "weight slip",
      "shipper weight", "verified weight"], "vgm"),
    # Shipping advice / pre-alert
    (["booking confirmed", "booking acknowledgement", "shipment confirmed",
      "pre-alert", "pre alert", "arrival notice", "departure notice",
      "goods dispatched", "goods shipped", "shipped today",
      "vessel departed", "loaded on vessel"], "shipping_advice"),
    # Waiting / demurrage
    (["waiting at gate", "waiting at terminal", "driver waiting", "truck waiting",
      "free time expired", "free days expired", "per diem",
      "storage accruing", "demurrage accruing"], "waiting_time"),
]

# ─────────────────────────────────────────────────────────────────
# ENTITY REGISTRY (ported from src/config/referenceData.ts)
# ─────────────────────────────────────────────────────────────────

# Each entry: (canonical_name, entity_type, roles, aliases)
# Priority: deepsea_terminal(4) > depot(3) > transporter(2) > carrier(1)

_ENTITY_DATA: list[tuple[str, str, list[str], list[str]]] = [
    # DEEPSEA TERMINALS
    ('ECT Delta Terminal',           'deepsea_terminal', ['deepsea_terminal'], ['ect delta','ect','ect euromax','europe combined terminals']),
    ('APM Terminals Maasvlakte',     'deepsea_terminal', ['deepsea_terminal'], ['apm terminals','apmt','apm maasvlakte','apmt maasvlakte','apm rotterdam']),
    ('RWG Terminal',                 'deepsea_terminal', ['deepsea_terminal'], ['rwg','rotterdam world gateway','world gateway']),
    ('EUROMAX Terminal',             'deepsea_terminal', ['deepsea_terminal'], ['euromax terminal','euromax rotterdam','euromax']),
    ('Hutchison Ports Rotterdam',    'deepsea_terminal', ['deepsea_terminal'], ['hutchison ports rotterdam','hutchison rotterdam','hutchison ecth','ecth']),
    ('MSC PSA European Terminal',    'deepsea_terminal', ['deepsea_terminal'], ['msct','msc psa','psa antwerp','msc psa european terminal','deurganckdok']),
    ('DP World Antwerp Gateway',     'deepsea_terminal', ['deepsea_terminal'], ['dp world antwerp','antwerp gateway','dpw antwerp']),
    ('Eurogate Bremerhaven',         'deepsea_terminal', ['deepsea_terminal'], ['eurogate bremerhaven','bct','bremer container terminal']),
    ('NTB Bremerhaven',              'deepsea_terminal', ['deepsea_terminal'], ['ntb','north sea terminal bremerhaven','nst bremerhaven']),

    # INLAND DEPOTS (many dual-role: depot + transporter)
    ('Germersheim DPW',          'depot', ['depot','transporter'], ['germersheim dpw','dpw germersheim','germersheim','dp world germersheim','degrh01','dp world intermodal b.v.','dp world intermodal bv','dp world intermodal','dpw intermodal','dp world']),
    ('HP Duisburg',              'depot', ['depot','transporter'], ['hp duisburg','hutchison ports duisburg','hutchison duisburg','hutchison ports duisburg rhine']),
    ('Contargo Rhine Ruhr',      'depot', ['depot','transporter'], ['contargo rhine ruhr','contargo ruhr','contargo dortmund','contargo duisburg']),
    ('Contargo Trimodal',        'depot', ['depot','transporter'], ['contargo trimodal','contargo köln','contargo cologne','contargo neuss']),
    ('Contargo',                 'depot', ['depot','transporter'], ['contargo']),
    ('Mainz Frankenbach',        'depot', ['depot','transporter'], ['mainz frankenbach','frankenbach','mainz depot']),
    ('Gustavsburg Contargo',     'depot', ['depot','transporter'], ['gustavsburg contargo','gustavsburg','contargo gustavsburg']),
    ('HGK',                      'depot', ['depot','transporter'], ['hgk shipping','hgk','hgk transport','hgk barge']),
    ('European Gateway Services','depot', ['depot','transporter'], ['european gateway services','european gateway','eur gateway services','eurgateway','eurogateways','european gateway services bv']),
    ('CTS Container-Terminal',   'depot', ['depot','transporter'], ['cts container-terminal gmbh','cts container terminal gmbh','cts container terminal','cts container-terminal','cts terminal','cts gmbh','cts']),
    ('H&S Andernach',            'depot', ['depot','transporter'], ['h&s andernach','h s andernach','hs andernach','deajhra','h&s schiffahrts andernach','h+s andernach']),
    ('Bonn AZS',                 'depot', ['depot','transporter'], ['bonn azs','azs bonn','debnx01','bon depot']),
    ('Trier AZS',                'depot', ['depot','transporter'], ['trier azs','azs trier','detreaz']),
    ('EGS Nuremberg',            'depot', ['depot','transporter'], ['egs nuremberg','egs nürnberg','egs','denue02']),
    ('ZSK am Zehnhoff',          'depot', ['depot'],               ['am zehnhoff','zehnhoff','zsk','andernach zehnhoff']),
    ('Rheinhafen Andernach',     'depot', ['depot'],               ['rheinhafen andernach','andernach depot']),
    ('DIT Depot',                'depot', ['depot'],               ['dit depot','dit duisburg','duisburg intermodal']),
    ('RRT Depot',                'depot', ['depot'],               ['rrt depot','rrt duisburg']),
    ('Nürnberg CDN',             'depot', ['depot'],               ['nuernberg cdn','nürnberg cdn','cdn nuremberg','cdn nürnberg']),
    ('Moerdijk Container Terminal','depot',['depot'],              ['moerdijk','mct moerdijk','container terminal moerdijk']),
    ('Venlo Container Terminal', 'depot', ['depot'],               ['venlo terminal','venlo container']),
    ('Nijmegen Inland Terminal', 'depot', ['depot'],               ['nijmegen terminal','barge nijmegen']),

    # APPROVED SPECIALIST INLAND HAULIERS
    ('Starmans',            'transporter', ['transporter'],          ['starmans']),
    ('Henk Dammes',         'transporter', ['transporter'],          ['henk dammes','dammes']),
    ('Falcoline',           'transporter', ['transporter'],          ['falcoline','falcoline gmbh','falcoline transport','falcoline spedition','falcoline belgium','falcoline belgie','falco lines belgium nv','falco lines belgium','falcolines belgium nv','falco lines nv']),
    ('GTS Coldchain',       'transporter', ['transporter'],          ['gts coldchain','gts cold','gts truck','gts logistics','gts duisburg','gts transport','gts']),
    ('CTV Vrede',           'transporter', ['transporter','depot'],  ['ctv vrede','ctv transport','ctv','ctv spedition','ctv gmbh']),
    ('EKB Transport',       'transporter', ['transporter','depot'],  ['ekb transport','ekb']),
    ('Optimodal Nederland', 'transporter', ['transporter'],          ['optimodal nederland bv','optimodal nederland','optimodal']),
    ('Kiem Transport',      'transporter', ['transporter'],          ['kiem transport','kiem']),
    ('DCH Düsseldorf',      'transporter', ['transporter'],          ['dch duesseldorfer container-hafen','dch düsseldorfer container-hafen','dch duesseldorf','dch container hafen','dch container-hafen','dch duisburg','dch']),

    # KNOWN CARRIERS (blocked from customer role, NOT in transporter performance)
    ('DB Schenker',          'carrier', ['carrier'], ['db schenker','schenker','dbschenker']),
    ('DHL Freight',          'carrier', ['carrier'], ['dhl freight','dhl logistics','dhl']),
    ('DSV',                  'carrier', ['carrier'], ['dsv road','dsv air','dsv logistics','dsv']),
    ('Rhenus Logistics',     'carrier', ['carrier'], ['rhenus logistics','rhenus road','rhenus transport','rhenus']),
    ('Dachser',              'carrier', ['carrier'], ['dachser']),
    ('Kuehne+Nagel',         'carrier', ['carrier'], ['kuehne nagel','kühne nagel','kuhne nagel','k+n','kuehne+nagel']),
    ('XPO Logistics',        'carrier', ['carrier'], ['xpo logistics','xpo transport','xpo']),
    ('Geodis',               'carrier', ['carrier'], ['geodis']),
    ('Ceva Logistics',       'carrier', ['carrier'], ['ceva logistics','ceva']),
    ('Samskip',              'carrier', ['carrier'], ['samskip']),
    ('Nedcargo',             'carrier', ['carrier'], ['nedcargo']),
    ('Hellmann Worldwide',   'carrier', ['carrier'], ['hellmann worldwide logistics','hellmann worldwide','hellmann logistics','hellmann']),
    ('Bolloré Logistics',    'carrier', ['carrier'], ['bolloré logistics','bollore logistics','bollore','bolloré']),
    ('BLG Logistics',        'carrier', ['carrier'], ['blg logistics','blg']),
    ('Yusen Logistics',      'carrier', ['carrier'], ['yusen logistics','nyk logistics','yusen']),
    ('Raben Group',          'carrier', ['carrier'], ['raben group','raben transport','raben']),
    ('Gefco',                'carrier', ['carrier'], ['gefco','ceva gefco']),
    ('Nacco',                'carrier', ['carrier'], ['nacco','nacco logistics','naco']),
]

_ENTITY_PRIORITY = {'deepsea_terminal': 4, 'depot': 3, 'transporter': 2, 'carrier': 1, 'customer': 0}

# Build alias → (canonical, entity_type, roles) lookup
_ALIAS_MAP: dict[str, tuple[str, str, list[str]]] = {}
for _canon, _etype, _roles, _aliases in _ENTITY_DATA:
    for _alias in _aliases:
        _existing = _ALIAS_MAP.get(_alias)
        if not _existing or _ENTITY_PRIORITY.get(_etype, 0) > _ENTITY_PRIORITY.get(_existing[1], 0):
            _ALIAS_MAP[_alias] = (_canon, _etype, _roles)


def _resolve_entity(name: str) -> tuple[str, str, list[str]] | None:
    """Return (canonical_name, entity_type, roles) for a name, or None."""
    if not name:
        return None
    low = name.lower().strip()
    # Exact alias match
    if low in _ALIAS_MAP:
        return _ALIAS_MAP[low]
    # Substring match (entity alias contained in the name)
    best: tuple[str, str, list[str]] | None = None
    best_len = 0
    for alias, entry in _ALIAS_MAP.items():
        if alias in low and len(alias) > best_len:
            best = entry
            best_len = len(alias)
    return best


def _is_operational_transporter(name: str) -> bool:
    """True if entity has transporter role (approved haulier or dual-role depot)."""
    result = _resolve_entity(name)
    if result is None:
        return False
    _, _, roles = result
    return 'transporter' in roles


def _is_blocked_from_customer(name: str) -> bool:
    """True if entity should NOT appear in Customer Burden."""
    result = _resolve_entity(name)
    if result is None:
        return False
    _, etype, _ = result
    return etype in ('deepsea_terminal', 'depot', 'transporter', 'carrier')


def _canonical_transporter_name(name: str) -> str | None:
    """Return canonical name if entity is a transporter, else None."""
    result = _resolve_entity(name)
    if result is None:
        return None
    canonical, _, roles = result
    if 'transporter' in roles:
        return canonical
    return None


# ─────────────────────────────────────────────────────────────────
# TEXT EXTRACTION LAYER
# Extract reference values from free-text (subject + description + isr)
# ─────────────────────────────────────────────────────────────────

# ISO 6346 container: 3 owner letters + category (U/J/Z) + 6 digits + optional check digit
_RE_CONTAINER = re.compile(r'\b([A-Z]{3}[UJZ])\s?(\d{6})\s?(\d)?\b')

# Booking ref: keyword + optional qualifier + value
_RE_BOOKING_EXTRACT = re.compile(
    r'\b(?:booking|bkg|bkng|reserv(?:ation)?)\s*(?:ref(?:erence)?|no\.?|num(?:ber)?|#)?\s*[:\-]?\s*([A-Z0-9]{4,20})\b',
    re.I)

# Load ref: keyword + value
_RE_LOAD_REF_EXTRACT = re.compile(
    r'\b(?:load[\s\-]?ref(?:erence)?|loadref|laadreferentie|ladereferenz|laad[\s\-]?ref)\s*[:\-]?\s*([A-Z0-9]{4,20})\b',
    re.I)

# MRN: EU customs reference (year + country + 14-16 alphanumeric)
_RE_MRN_EXTRACT = re.compile(r'\bMRN\s*[:\-]?\s*([0-9]{2}[A-Z]{2}[A-Z0-9]{12,16})\b', re.I)

# T1 transit reference
_RE_T1_EXTRACT = re.compile(
    r'\bT1\s*(?:doc(?:ument)?)?\s*(?:no\.?|num(?:ber)?|#|ref(?:erence)?)?\s*[:\-]?\s*([A-Z0-9][\w\-]{5,24})\b',
    re.I)

# ZIP: Dutch (4 digits + 2 letters), German (5 digits)
_RE_ZIP_NL = re.compile(r'\b(\d{4})\s?([A-Z]{2})\b')
_RE_ZIP_DE = re.compile(r'(?<!\d)(\d{5})(?!\d)')

_EXTRACT_STOPWORDS = frozenset([
    'THE', 'FOR', 'OUR', 'YOUR', 'REF', 'AND', 'FROM', 'WITH',
    'THIS', 'THAT', 'HAVE', 'BEEN', 'ALSO', 'WILL', 'DOES', 'NOT',
])


def _extract_container(text: str) -> str | None:
    m = _RE_CONTAINER.search(text.upper())
    if m:
        return m.group(1) + m.group(2) + (m.group(3) or '')
    return None


def _extract_booking_ref(text: str) -> str | None:
    m = _RE_BOOKING_EXTRACT.search(text)
    if m:
        val = m.group(1).strip().upper()
        return None if (val in _EXTRACT_STOPWORDS or len(val) < 4) else val
    return None


def _extract_load_ref_value(text: str) -> str | None:
    m = _RE_LOAD_REF_EXTRACT.search(text)
    if m:
        val = m.group(1).strip().upper()
        return None if (val in _EXTRACT_STOPWORDS or len(val) < 4) else val
    return None


def _extract_mrn(text: str) -> str | None:
    m = _RE_MRN_EXTRACT.search(text)
    return m.group(1).upper() if m else None


def _extract_t1_ref(text: str) -> str | None:
    m = _RE_T1_EXTRACT.search(text)
    if m:
        val = m.group(1).strip().upper()
        return None if (val in _EXTRACT_STOPWORDS or len(val) < 4) else val
    return None


def _extract_zip_from_text(text: str) -> str | None:
    m = _RE_ZIP_NL.search(text)
    if m:
        return f"{m.group(1)}{m.group(2)}"
    m = _RE_ZIP_DE.search(text)
    if m:
        raw = m.group(1)
        return raw if len(raw) == 5 else None
    return None


def _extract_transporter_from_text(text: str) -> str | None:
    """Find a known transporter entity name in combined free text."""
    t_lower = text.lower()
    best_canon: str | None = None
    best_len = 0
    for alias, (canonical, _etype, roles) in _ALIAS_MAP.items():
        if 'transporter' not in roles or len(alias) < 4:
            continue
        if alias in t_lower and len(alias) > best_len:
            best_canon = canonical
            best_len = len(alias)
    return best_canon


def _extract_all_refs(combined: str) -> dict:
    """Extract all reference values from combined free text."""
    return {
        'ext_container':   _extract_container(combined),
        'ext_booking_ref': _extract_booking_ref(combined),
        'ext_load_ref':    _extract_load_ref_value(combined),
        'ext_mrn':         _extract_mrn(combined),
        'ext_t1_ref':      _extract_t1_ref(combined),
        'ext_zip':         _extract_zip_from_text(combined),
        'ext_transporter': _extract_transporter_from_text(combined),
    }


# ─────────────────────────────────────────────────────────────────
# COLUMN ALIASES
# ─────────────────────────────────────────────────────────────────

COLUMN_ALIASES: dict[str, list[str]] = {
    "subject":     ["subject", "title", "case subject", "case title", "onderwerp", "email subject"],
    "description": ["description", "desc", "case description", "body", "email body", "message body", "comments", "details"],
    "isr_details": ["isr details", "isr_details", "isr", "isr detail", "sr details", "internal details"],
    "customer":    ["customer", "account", "client", "company", "klant", "account name", "customer name", "debtor"],
    "transporter": ["transporter", "haulier", "carrier", "hauler", "transport company", "vervoerder"],
    "zip":         ["zip", "postcode", "post code", "zip code", "zipcode", "postal code", "postal_code"],
    "area":        ["area", "region", "zone", "terminal", "location", "hub", "site"],
    "date":        ["date", "created date", "creation date", "created at", "created_at", "closed date", "datum", "opened"],
    "status":      ["status", "case status", "state", "resolution"],
    "priority":    ["priority", "urgency", "severity"],
    "category":    ["category", "type", "case type", "issue type", "categorie"],
    "hours":       ["hours", "time spent", "duration", "effort", "uren"],
    "case_number": ["case number", "case no", "case no.", "case #", "case id", "ticket number",
                    "ticket id", "incident number", "case ref", "case_number", "casenumber", "case nr"],
    "booking_ref": ["booking", "booking ref", "booking reference", "booking no", "booking number",
                    "bkg", "bkg ref", "booking_ref", "reservation", "res no"],
}

# ─────────────────────────────────────────────────────────────────
# ZIP → AREA RULES
# ─────────────────────────────────────────────────────────────────
# Only Mainz/Germersheim and Duisburg/Rhine-Ruhr are shown in hotspot charts.
# (Matches frontend zipAreaRules.ts DE_DEPOT_ROUTING_RULES logic.)

def _resolve_zip_to_area(raw_zip: str, context: str = "") -> str | None:
    if not raw_zip:
        return None
    z = raw_zip.strip().upper().replace(" ", "")
    # Strip country prefix
    m = re.match(r'^([A-Z]{2})[-]?(.+)$', z)
    if m:
        country_hint, z = m.group(1), m.group(2)
    else:
        country_hint = ""

    ctx = context.lower()
    force_nl = country_hint == "NL" or "netherlands" in ctx or "nederland" in ctx
    force_be = country_hint == "BE" or "belgium" in ctx or "belgie" in ctx
    force_ch = country_hint == "CH" or "switzerland" in ctx or "schweiz" in ctx
    force_at = country_hint == "AT" or "austria" in ctx or "österreich" in ctx

    is_de = bool(re.match(r'^\d{5}$', z))

    if is_de and not (force_nl or force_be or force_ch or force_at):
        prefix = int(z[:2])
        # Mainz / Germersheim corridor
        if prefix in range(35, 40) or z[:2] == "55" or prefix in range(60, 66) or prefix in range(66, 80) or prefix in range(80, 90) or prefix in range(95, 98):
            return "Mainz / Germersheim"
        # All other German ZIPs
        return "Duisburg / Rhine-Ruhr"

    # Non-DE: return None (not shown in hotspot chart)
    return None


# ─────────────────────────────────────────────────────────────────
# INTENT-AWARE CLASSIFICATION ENGINE
# Ported from src/lib/issueRules.ts + fallbackIssueRules.ts
# ─────────────────────────────────────────────────────────────────

STRONG_SIGNAL_CONFIDENCE = 0.85
WEAK_SIGNAL_CONFIDENCE   = 0.55
STATE_DETECTION_BONUS    = 0.10
MAX_CONFIDENCE           = 0.98
CONTEXT_WINDOW_BEFORE    = 120
CONTEXT_WINDOW_AFTER     = 160

# ── Intent phrase lists ────────────────────────────────────────────
_MISSING_SIGNALS = [
    'please provide', 'please send', 'please share', 'please forward',
    'please supply', 'kindly provide', 'kindly send',
    'please add', 'please include', 'kindly add',
    'can you send', 'can you provide', 'can you share', 'can you advise',
    'please advise', 'please let us know', 'could you please', 'could you advise',
    'we need', 'we require', 'we are waiting', 'still waiting',
    'not received', 'not provided', 'not yet received', 'not yet sent',
    'not available', 'not found', 'not in', 'not attached',
    'missing', 'absent', 'no ',
    'without ', 'lack of', 'lacking',
    'needed', 'required', 'request for', 'requesting',
    "haven't received", 'have not received', 'did not receive',
    "hasn't been", 'has not been',
    'urgent', 'asap', 'as soon as possible',
]
_PROVIDED_SIGNALS = [
    'see below', 'find below', 'please find below',
    'find attached', 'please find attached', 'see attached',
    'as requested', 'as per your request', 'as per request',
    'herewith', 'hereby', 'please find herewith',
    'attached', 'enclosed', 'sending', 'sent', 'forwarded',
    'here is', 'here are', 'find enclosed',
    'providing', 'supplied', 'sharing',
    'please see', 'see below for', 'details below',
    'confirmed', 'confirmation', 'done', 'completed',
    'ref no ', 'ref no.', 'reference no ', 'reference no.',
    'ref: ', 'loadref: ', 'load ref: ',
    'ref #', 'reference #',
    'has been provided', 'was provided', 'already provided',
    'has been sent', 'was sent', 'already sent',
    'resolved',
    'has been updated', 'was updated', 'is updated', 'now updated',
    'has been cleared', 'was cleared', 'is cleared', 'now cleared',
    'all ok', 'is ok', 'now ok',
    'is complete', 'has been completed', 'now complete',
    'is done', 'has been done',
]
_AMENDED_SIGNALS = [
    'please correct', 'please update', 'please amend', 'please change',
    'please revise', 'please modify',
    'correction', 'correction needed', 'needs to be corrected',
    'updated to', 'revised', 'amended', 'corrected', 'modified',
    'wrong', 'incorrect', 'error in', 'mistake in',
    'should be', 'instead of', 'replace with', 'change from',
    'update required', 'needs updating',
    'cancelled', 'cancellation', 'cancel booking', 'cancelling',
]
_DELAYED_SIGNALS = [
    'still waiting', 'still not', 'not yet', 'overdue',
    'late', 'delayed', 'behind schedule', 'passed eta',
    'expected yesterday', 'expected today', 'should have arrived',
    'should have been', 'was due', 'was expected',
    'not arrived', 'not collected', 'not delivered',
    'driver late', 'truck late', 'vehicle late',
    'running late', 'chasing', 'following up', 'follow up',
]
_ESCALATED_SIGNALS = [
    'escalate', 'escalating', 'escalation',
    'complaint', 'complaining', 'complain',
    'unhappy', 'dissatisfied', 'frustrated',
    'management', 'director', 'senior',
    'unacceptable', 'not acceptable', 'very urgent',
    'extremely urgent', 'highest priority',
]
_INFORMATIONAL_SIGNALS = [
    'for your information', 'fyi', 'for your records', 'for your reference',
    'please note', 'just to let you know', 'informing you',
    'confirming that', 'to confirm', 'update on', 'status update',
    'please be advised', 'advising', 'notifying',
    'no action required', 'no action needed', 'no further action',
]
_NEGATION_GUARD = [
    'not provided', 'not received', 'not yet received', 'not yet sent',
    'not attached', 'not available', 'not found', 'not yet',
    'has not been', 'have not', "hasn't been", 'did not receive',
    'cannot', 'not confirmed', 'not issued', 'not in system',
]

def _detect_state_windowed(window: str) -> str:
    """Detect issue state from a per-topic context window (with negation guard)."""
    t = window.lower()
    has_negation = any(p in t for p in _NEGATION_GUARD)

    if any(p in t for p in _ESCALATED_SIGNALS):   return 'escalated'
    if any(p in t for p in _AMENDED_SIGNALS):      return 'amended'
    if not has_negation:
        if any(p in t for p in _PROVIDED_SIGNALS): return 'provided'
    if any(p in t for p in _MISSING_SIGNALS):      return 'missing'
    if has_negation:                                return 'missing'
    if any(p in t for p in _DELAYED_SIGNALS):      return 'delayed'
    if any(p in t for p in _INFORMATIONAL_SIGNALS):return 'informational'
    return 'unknown'

# Document topics that fork to ref_provided when state=provided
_DOC_TOPICS = {'load_ref', 'customs', 't1', 'portbase', 'bl'}

def _resolve_issue_id(topic: str, state: str) -> str:
    if state == 'provided' and topic in _DOC_TOPICS:
        return 'ref_provided'
    if topic == 'load_ref' and state in ('informational', 'amended'):
        return 'ref_provided'
    return topic

# ── Topic rules (ported from TOPIC_RULES in issueRules.ts) ────────
_TOPIC_RULES: list[dict] = [
    {
        'topic': 'load_ref',
        'strong': [
            'load ref', 'loadref', 'load reference',
            'missing load ref', 'missing load reference', 'please provide load ref',
            'please send load ref', 'load ref still missing', 'no load ref received',
            'load reference not provided', 'please send the loadref', 'please send loadref',
            'loadref missing', 'release ref missing', 'missing release reference',
            'please provide release ref', 'loading reference missing',
            'ref required for loading', 'load ref not received', 'load ref not provided',
            'load ref required', 'loadref required', 'no loadref', 'no load reference',
            # Dutch
            'laadreferentie ontbreekt', 'loadref ontbreekt', 'graag loadref sturen',
            'graag laadreferentie sturen', 'loadref nog niet ontvangen',
            'laadreferentie niet ontvangen', 'graag de loadref', 'loadref nog niet',
            'laadreferentie nog niet',
            # German
            'ladereferenz fehlt', 'lade referenz fehlt', 'bitte ladereferenz senden',
            'referenz fehlt', 'ladereferenz nicht erhalten', 'ladereferenz benoetigt',
            'fehlende ladereferenz',
            # Informal
            'driver needs load ref', 'ref required for pickup',
            'chauffeur heeft referentie nodig', 'fahrer braucht referenz',
        ],
        'weak': [
            'correct ref', 'corrected ref', 'updated ref', 'update ref',
            'booking ref', 'booking reference',
            'booking number', 'reference number', 'ref number', 'ref no',
            'order reference', 'order number', 'po number', 'purchase order',
            'job reference', 'job number', 'shipment reference', 'shipment ref',
            'consignment number', 'consignment ref', 'load number',
            'ref missing', 'no reference provided', 'without load reference',
            'missing reference', 'ref not received', 'ref not provided',
            'load number missing',
        ],
    },
    {
        'topic': 'transport_order',
        'strong': [
            'transport order', 'transport instruction', 'haulier order', 'haulier instruction',
            'transport booking order', 'driver order', 'driver instruction',
            'missing transport order', 'transport order missing', 'transport order not received',
            'transport order required', 'please send transport order', 'send transport order',
            'send us the transport order', 'no transport order', 'transport order not issued',
            'work order', 'workorder', 'work-order',
            'work order missing', 'missing work order', 'work order not received',
            'work order required', 'please send work order', 'no work order',
            # Dutch/German
            'transportorder', 'transport opdracht', 'transportopdracht',
            'graag transportopdracht sturen', 'transportorder ontbreekt',
            'transportauftrag', 'transportauftrag fehlt', 'bitte transportauftrag senden',
            'fahrauftrag', 'fahrauftrag fehlt',
        ],
        'weak': ['tro', 'carrier instruction', 'carrier order', 'transport confirmation',
                 'haulage instruction', 'movement order'],
    },
    {
        'topic': 'customs',
        'strong': [
            'customs', 'douane', 'zoll', 'customs clearance',
            'customs hold', 'customs delay', 'customs release', 'customs check',
            'customs inspection', 'customs exam', 'import declaration',
            'export declaration', 'mrn', 'customs entry', 'customs documents',
            'customs docs', 'customs doc', 'customs documentation', 'customs paperwork',
            'customs broker', 'clearing agent', 'customs agent',
            'eur1', 'certificate of origin', 'phytosanitary', 'health cert',
            'import license', 'export license',
            'hs code', 'tariff code', 'commodity code', 'eori',
            'import duty', 'export duty', 'ata carnet', 'bonded warehouse',
            'customs documents missing', 'no customs documents received',
            'please provide customs documents', 'please send customs documents',
            'missing customs documents', 'customs docs missing', 'mrn missing',
            'missing mrn', 'cannot proceed without mrn', 'mrn not received',
            'mrn not provided', 'mrn required', 'need mrn', 'require mrn',
            'portbase customs missing', 'portbase customs docs missing',
            # Dutch
            'douane documenten ontbreken', 'douane documenten niet ontvangen',
            'graag douane documenten sturen', 'mrn ontbreekt',
            'douanedocumenten ontbreken', 'douanepapieren ontbreken',
            # German
            'zolldokumente fehlen', 'zollpapiere fehlen',
            'bitte zollpapiere senden', 'mrn fehlt',
        ],
        'weak': [
            'duty',
            'missing documents', 'documents missing', 'documentation missing',
            'documents not received', 'packing list missing',
            'certificate missing', 'compliance documents', 'regulatory documents',
        ],
    },
    {
        'topic': 't1',
        'strong': [
            't1 document', 'transit document', 'community transit',
            'transit declaration', 'transit entry', 't1 missing', 't1 error',
            'transit pass', 'ncts', 'transit guarantee', 'transit bond',
            'transit closure', 'transit rejection', 'procedure 7100',
            'transit not closed', 'transit open', 'customs transit',
            'please send t1', 'missing t1', 't1 still missing', 't1 not received',
            't1 not provided', 'driver needs t1', 'cannot proceed without t1',
            't1 document missing', 'need t1', 'require t1',
            # Dutch/German
            't1 ontbreekt', 'graag t1 sturen', 't1 nog niet ontvangen',
            't1 niet ontvangen', 'graag de t1', 't1 document ontbreekt',
            't1 fehlt', 'bitte t1 senden', 't1 nicht erhalten',
            't1 dokument fehlt', 't1 benoetigt',
        ],
        'weak': ['t1', 't2', 'transit procedure', 'transit mrn',
                 'transit movement', 'transit status', 'in transit'],
    },
    {
        'topic': 'delay',
        'strong': [
            'delayed', 'not on time', 'late arrival', 'late delivery',
            'missed eta', 'overdue', 'behind schedule', 'no show',
            'not arrived', 'late collection', 'not collected', 'not delivered',
            'running late', 'past eta', 'missed appointment',
            'driver late', 'driver delayed', 'vehicle delayed', 'truck delayed',
            'not on-time', 'failed delivery', 'failed collection',
            'missed time slot', 'delivery window missed',
            'hasn\'t arrived', 'have not arrived', 'still not here',
            'not yet delivered', 'not yet collected', 'driver no show',
            # Dutch
            'nog niet aangekomen', 'niet tijdig', 'te laat aangekomen',
            'nog steeds niet', 'nog wachten op', 'niet opgehaald',
            'niet bezorgd', 'niet afgeleverd', 'vertraging gemeld',
            # German
            'noch nicht angekommen', 'nicht rechtzeitig', 'zu spät',
            'immer noch nicht', 'nicht abgeholt', 'nicht zugestellt',
            'verzögert angekommen',
        ],
        'weak': [
            'delay', 'late', 'still waiting', 'expected today', 'expected yesterday',
            'where is my', 'not yet arrived', 'postponed', 'rescheduled',
            'held up', 'stuck', 'on hold',
        ],
    },
    {
        'topic': 'closing_time',
        'strong': [
            'cutoff', 'cut-off', 'cut off', 'closing time', 'closing deadline',
            'missed cutoff', 'after cutoff', 'vgm deadline', 'vgm cutoff',
            'gate cutoff', 'gate cut off', 'terminal cutoff', 'missed closing',
            'missed vessel', 'missed ship', 'missed sailing', 'missed departure',
            'missed loading', 'sailed without', 'vessel already departed',
            'too late for vessel',
        ],
        'weak': [
            'deadline', 'closing', 'gate closed', 'terminal closed', 'vessel cutoff',
            'departure cutoff', 'submission deadline', 'filing deadline', 'vgm',
        ],
    },
    {
        'topic': 'amendment',
        'strong': [
            'amendment', 'booking amendment', 'booking change',
            'address correction', 'wrong address', 'incorrect address',
            'consignee change', 'shipper change', 'wrong weight',
            'incorrect weight', 'wrong volume', 'wrong dimensions',
            'wrong description', 'incorrect description', 'wrong consignee',
            'wrong shipper', 'wrong port', 'wrong destination',
            'routing change', 'please correct', 'please amend',
            'please update the booking', 'rebook', 're-book',
            'booking cancelled', 'booking cancellation', 'cancel booking',
            'order cancelled', 'shipment cancelled', 'transport cancelled',
            'loading cancelled', 'pickup cancelled', 'delivery cancelled',
            'schedule adjustment', 'correction to planning', 'delivery change',
            'routing update', 'operational correction', 'amend booking',
            # Dutch/German
            'boeking wijziging', 'boekingswijziging', 'correctie op boeking',
            'buchungsänderung', 'buchungskorrektur', 'änderung der buchung',
        ],
        'weak': [
            'correction', 'amend', 'change request', 'modification',
            'update booking', 'rate correction', 'wrong details',
            'incorrect details', 'booking error', 'booking mistake',
            'please update', 'needs updating',
        ],
    },
    {
        'topic': 'waiting_time',
        'strong': [
            'waiting time', 'demurrage', 'detention', 'wait time',
            'waiting costs', 'standing time', 'free time exceeded',
            'container detention', 'chassis detention', 'demurrage charge',
            'detention charge', 'free period exceeded', 'storage charge',
            'quay rent', 'extra storage days', 'storage days exceeded',
        ],
        'weak': [
            'waiting at terminal', 'waiting at port', 'waiting at depot',
            'long wait', 'extended wait', 'idle time', 'congestion',
            'port congestion', 'terminal congestion', 'queue', 'queuing',
            'waiting to load', 'waiting to unload',
        ],
    },
    {
        'topic': 'equipment_release',
        'strong': [
            'release order', 'pin code', 'pickup authorisation',
            'release pin', 'delivery order', 'pin not received',
            'pin not working', 'pin expired', 'pin invalid',
            'accepted at terminal', 'terminal acceptance',
            'terminal release', 'gate out', 'container release',
            'cargo release', 'release not received',
        ],
        'weak': [
            'release', 'acceptance', 'cannot pick up', 'cannot collect',
            'collection rejected', 'gate refused',
        ],
    },
    {
        'topic': 'equipment',
        'strong': [
            'reefer failure', 'temperature deviation', 'temperature alarm',
            'temperature exceedance', 'cold chain failure', 'genset failure',
            'container damage', 'trailer damage', 'broken seal',
            'seal missing', 'seal discrepancy', 'faulty unit',
            'defective container', 'container unavailable', 'equipment shortage',
            'truck breakdown', 'vehicle breakdown', 'mechanical failure',
            'portable not ok', 'portable not in order', 'portable not acceptable',
            'equipment not ok', 'equipment not in order', 'equipment not acceptable',
            'unit not ok', 'unit not in order', 'unit not acceptable',
            'container not ok', 'container not in order', 'container not acceptable',
            'trailer not ok', 'not roadworthy', 'unit defective', 'unit damaged',
            'equipment defect', 'equipment failure', 'equipment fault',
            'container defect', 'container fault', 'trailer defect', 'trailer fault',
            # Dutch/German
            'container beschadigd', 'container niet ok', 'container defect',
            'reefer defect', 'container beschaedigt', 'container defekt', 'reefer defekt',
        ],
        'weak': [
            'equipment issue', 'container not available', 'no container',
            'reefer', 'seal broken', 'flat tyre', 'tyre issue',
            'wrong container type', 'wrong equipment type',
        ],
    },
    {
        'topic': 'tracking',
        'strong': [
            'where is my', 'where are my', 'shipment status', 'track and trace',
            'proof of delivery', 'pod not received', 'pod missing',
            'delivery confirmation', 'delivery proof', 'signed delivery',
            'eta update', 'current eta', 'revised eta', 'expected arrival',
            # Common tracking requests
            'can you confirm delivery', 'please confirm receipt', 'confirm arrival',
            'track and trace update', 'please advise status', 'any news on',
            'what is the current status', 'update on delivery',
            # Dutch
            'waar is mijn', 'waar zijn mijn', 'status van', 'update over',
            'wanneer wordt', 'kunt u bevestigen', 'graag bevestiging',
            # German
            'wo ist meine', 'wo sind meine', 'status von', 'update zu',
            'wann kommt', 'bitte bestätigen', 'können sie bestätigen',
        ],
        'weak': [
            'tracking', 'where is', 'status update', 'no update',
            'visibility', 'no tracking', 'not visible', 'no information',
            'whereabouts', 'location query', 'eta', 'pod',
        ],
    },
    {
        'topic': 'communication',
        'strong': [
            'no response', 'no reply', 'not answered', 'unanswered',
            'cannot reach', 'not reachable', 'unresponsive',
            'poor communication', 'no feedback', 'lack of response',
            'urgent escalation', 'service complaint', 'service failure',
        ],
        'weak': [
            'escalation', 'complaint', 'dissatisfied', 'follow-up', 'follow up',
            'no contact', 'not informed', 'not notified', 'no notification',
            'chasing', 'second reminder', 'third reminder', 'as per my previous',
        ],
    },
    {
        'topic': 'portbase',
        'strong': [
            'portbase', 'port notification', 'pre-notification', 'port clearance',
            'pcs message', 'ata notification', 'atd notification',
            'pre arrival notification', 'port entry rejected',
            'arrival notification', 'departure notification',
            'portbase customs missing', 'portbase customs docs missing',
        ],
        'weak': [
            'port system', 'terminal notification', 'port pre-arrival',
            'vessel notification', 'port admin', 'port documentation',
            'port registration', 'port permit', 'berth notification',
        ],
    },
    {
        'topic': 'bl',
        'strong': [
            'bill of lading', 'b/l', 'sea waybill', 'original bl',
            'telex release', 'surrender bl', 'express bl',
            'bl correction', 'bl amendment', 'bl not received',
            'bl missing', 'hbl', 'mbl', 'house bl', 'master bl',
            'bl release', 'bl not available', 'bl draft',
            'bl copy', 'bl no', 'bl number', 'bl original', 'bl required',
            'please send bl', 'original bl required',
            # Dutch/German
            'cognossement', 'zee vrachtbrief', 'konnossement', 'seefrachtbrief',
        ],
        'weak': [
            'lading', 'bl error', 'bl incorrect', 'bl discrepancy',
            'waybill', 'cmr note', 'consignment note',
            'shipping document', 'cargo release', 'original documents',
            'original required',
        ],
    },
    {
        'topic': 'rate',
        'strong': [
            'rate query', 'rate dispute', 'invoice query', 'overcharge',
            'billing query', 'charge dispute', 'incorrect invoice',
            'rate discrepancy', 'invoice incorrect', 'wrong invoice',
            'invoice dispute', 'overcharged', 'undercharged', 'charge query',
            'selfbilling', 'self billing', 'self-billing', 'selfbill', 'self bill',
            'dch invoice', 'dch billing', 'dch report', 'dch cost',
            'extra cost invoice', 'extra costs invoice', 'extra costs report',
            'extra cost report', 'extrakostenrechnung',
            'extra kosten rapport', 'meerkosten rapport',
            'additional cost invoice', 'additional costs invoice',
            'billing report', 'billing issue', 'billing error', 'billing dispute',
            'cost invoice', 'waiting cost invoice', 'waiting costs invoice',
            'demurrage invoice', 'detention invoice', 'storage invoice',
            'credit note', 'credit memo', 'debit note', 'debit memo',
            'invoice not received', 'invoice missing', 'invoice outstanding',
            'commercial invoice query', 'commercial invoice dispute',
            'price correction', 'price adjustment', 'rate correction',
            'wrong rate applied', 'incorrect rate applied', 'corrected invoice', 'invoice correction',
            # Dutch/German
            'inkooporder', 'bestelnummer', 'bestellnummer',
            'po bedrag fout', 'po verschil', 'po abweichung',
            'storage cost', 'storage costs', 'waiting time charges',
            'waiting time invoice', 'waiting costs invoice',
            'opslagkosten', 'wachttijd kosten', 'lagerkosten', 'wartezeit kosten',
        ],
        'weak': [
            ' rate ', 'rate query', 'rate dispute', 'rate correction', 'rate discrepancy',
            'wrong rate', 'freight rate', 'rate inquiry',
            'pricing', 'surcharge', 'quotation',
            'tariff', 'refund request', 'payment dispute',
            'invoice', 'billing', 'extra cost', 'extra costs', 'additional charge',
            'cost report',
            'purchase order', 'po number', 'po no',
        ],
    },
    {
        'topic': 'damage',
        'strong': [
            'cargo loss', 'lost cargo', 'missing cargo', 'shortfall',
            'cargo claim', 'theft reported', 'goods stolen',
            'claim submitted', 'claim filed', 'insurance claim',
            'delivery shortage', 'wrong goods delivered', 'quantity short',
        ],
        'weak': [
            'damage', 'damaged', 'broken', 'contamination',
            'missing goods', 'shortage', 'goods missing', 'pilferage',
            'partial loss', 'total loss',
        ],
    },
    {
        'topic': 'scheduling',
        'strong': [
            'planning slot', 'time slot request', 'booking slot',
            'terminal slot', 'depot slot', 'slot allocation',
            'arrival window', 'collection window', 'delivery window',
            'appointment request', 'appointment confirmation',
            'pre-gate appointment',
            # Dutch/German
            'laadslot', 'afhaaltijd', 'levertijd', 'afhaaldatum', 'leverdatum',
            'ladeslot', 'abholzeit', 'lieferzeit', 'abholtermin', 'liefertermin',
        ],
        'weak': [
            'schedule', 'scheduling', 'allocation', 'slot',
            'time window', 'appointment',
        ],
    },
    {
        'topic': 'pickup_delivery',
        'strong': [
            'pickup planning', 'delivery planning', 'collection planning',
            'last-mile', 'last mile', 'home delivery', 'residential delivery',
            'delivery address', 'pickup address', 'collection address',
            'driver instruction', 'delivery instruction', 'access instruction',
            # Dutch/German
            'afhaal planning', 'lever planning', 'ophaalplanning',
            'abholplanung', 'lieferplanung',
        ],
        'weak': [
            'pickup', 'pick-up', 'pick up', 'delivery planning',
            'collection planning', 'route planning',
            'load date', 'loading date', 'loaddate', 'load day',
            'please advise load', 'advise loading',
        ],
    },
    {
        'topic': 'capacity',
        'strong': [
            'no capacity', 'not feasible', 'no space available', 'fully booked',
            'cannot accept this shipment', 'capacity not available', 'no slots available',
            'capacity constraint', 'at capacity', 'overbooked',
            'unable to accommodate', 'capacity limitation', 'capacity problem',
            'maximum capacity', 'no room available', 'no slot available',
        ],
        'weak': [
            'capacity', 'feasibility', 'feasible', 'no slots', 'no availability',
            'cannot accommodate', 'overloaded', 'no space', 'overbooking',
        ],
    },
    {
        'topic': 'shipping_advice',
        'strong': [
            'shipping advice', 'shipment advice', 'departure notice', 'arrival notice',
            'advice note', 'pre-advice', 'pre advice', 'shipping notice',
            # Dutch/German
            'aankomstbericht', 'vertrekbericht', 'laadbericht', 'losbericht',
            'aankomst avis', 'vertrek avis', 'losavis',
            'versandavis', 'eingangsavis', 'ausgangsavis', 'ladebericht', 'löschbericht',
            'ankunftsavis', 'abgangsavis',
        ],
        'weak': [' avis ', 'notice'],
    },
    {
        'topic': 'vgm',
        'strong': [
            'vgm', 'verified gross mass', 'weight note', 'weight certificate',
            'gross mass', 'container weight', 'vgm declaration', 'vgm required',
            'please send vgm', 'vgm missing', 'vgm not received',
            # Dutch/German
            'gewichtsnota', 'gewichtsverklaring', 'bruttogewicht', 'vgm ontbreekt',
            'gewichtsnote', 'vgm fehlt', 'vgm nicht erhalten',
        ],
        'weak': ['weight', 'gewicht'],
    },
    {
        'topic': 'seal',
        'strong': [
            'seal number', 'seal numbers', 'missing seal', 'new seal', 'seal request',
            'seal broken', 'seal tampered', 'please provide seal', 'seal details',
            'seal required', 'seal not provided', 'seal missing',
            # Dutch/German
            'zegel nummer', 'zegelnummer', 'zegel ontbreekt', 'nieuw zegel',
            'zegel verbroken', 'graag zegel', 'zegel details',
            'siegel nummer', 'siegelnummer', 'siegel fehlt', 'neues siegel',
            'siegel gebrochen', 'bitte siegel', 'siegel details',
        ],
        'weak': ['zegel', 'siegel'],
    },
    {
        'topic': 'dangerous_goods',
        'strong': [
            'dangerous goods', 'hazardous cargo', 'hazardous goods', 'hazmat',
            'imo class', 'imo number', 'imo declaration', 'adr class', 'un number',
            'un no', 'msds', 'sds sheet', 'safety data sheet', 'dg declaration',
            'dgd', 'dangerous goods declaration',
            # Dutch/German
            'gevaarlijke stoffen', 'gevaarlijke goederen', 'imo klasse', 'adr klasse',
            'veiligheidsblad', 'gefahrgut', 'gefährliche güter', 'gefahrstoff',
            'sicherheitsdatenblatt',
        ],
        'weak': ['imo', 'adr', 'hazardous'],
    },
    {
        'topic': 'ref_provided',
        'strong': [
            # Direct provision signals (person IS providing a reference)
            'ref below', 'reference below', 'load ref below', 'booking ref below',
            'please find the ref', 'ref provided below', 'see ref below',
            'reference update', 'updated reference', 'updated load ref',
            'correct reference', 'corrected reference', 'correct load ref',
            'providing reference', 'reference provided', 'ref has been provided',
            'ref has been sent', 'reference attached', 'load ref attached',
            'booking ref attached', 'load ref: ', 'booking ref: ', 'ref: ',
            'load reference is ', 'the booking ref is', 'the load ref is',
            'ref confirmed', 'booking ref confirmed', 'load ref confirmed',
            'sending load ref', 'forwarding load ref', 'sending booking ref',
            # Dutch
            'referentie hieronder', 'ref hieronder', 'ref bijgevoegd',
            'referentie bijgevoegd', 'loadref bijgevoegd', 'referentie is ',
            'loadref is ', 'loadref: ', 'laadreferentie is',
            # German
            'referenz unten', 'referenz anbei', 'referenz beigefügt',
            'referenz beigefuegt', 'die referenz ist ', 'referenz: ',
            'ladereferenz ist ', 'ladereferenz: ',
        ],
        'weak': [
            'ref provided', 'reference provided', 'ref sent', 'reference sent',
            'ref confirmed', 'booking confirmed', 'load confirmed',
            'reference update', 'ref update', 'info provided',
        ],
    },
]

def _classify_by_rules(text: str) -> list[dict]:
    """
    Primary classifier: per-topic context-window intent detection.
    Returns list of {issueId, state, confidence} sorted by confidence desc.
    """
    t = text.lower()
    matches = []

    for rule in _TOPIC_RULES:
        base_conf = 0.0
        first_pos = -1

        for sig in rule['strong']:
            pos = t.find(sig)
            if pos != -1:
                base_conf = max(base_conf, STRONG_SIGNAL_CONFIDENCE)
                if first_pos == -1:
                    first_pos = pos

        if base_conf < STRONG_SIGNAL_CONFIDENCE:
            for sig in rule['weak']:
                pos = t.find(sig)
                if pos != -1:
                    base_conf = max(base_conf, WEAK_SIGNAL_CONFIDENCE)
                    if first_pos == -1:
                        first_pos = pos

        if base_conf == 0 or first_pos == -1:
            continue

        # Per-topic context window (120 chars before, 160 after first match)
        win_start = max(0, first_pos - CONTEXT_WINDOW_BEFORE)
        win_end   = min(len(text), first_pos + CONTEXT_WINDOW_AFTER)
        window    = text[win_start:win_end]

        state = _detect_state_windowed(window)
        conf  = min(base_conf + (STATE_DETECTION_BONUS if state != 'unknown' else 0), MAX_CONFIDENCE)
        issue_id = _resolve_issue_id(rule['topic'], state)

        matches.append({'issueId': issue_id, 'state': state, 'confidence': conf})

    return sorted(matches, key=lambda m: m['confidence'], reverse=True)


# ── Fallback regex rules (ported from fallbackIssueRules.ts) ──────
_FALLBACK_RULES: list[dict] = [
    # Delay / timing
    {'issueId': 'delay',             'state': 'delayed',
     'pattern': re.compile(r'\b(not yet|still not|hasn.t arrived|haven.t received|expected .{1,20} but|we are still)\b', re.I),
     'confidence': 0.60},
    {'issueId': 'delay',             'state': 'delayed',
     'pattern': re.compile(r'\b(driver|truck|vehicle|courier|haulier)\b.{0,30}\b(not|late|missing|absent|didn.t|did not)\b', re.I),
     'confidence': 0.65},
    {'issueId': 'delay',             'state': 'delayed',
     'pattern': re.compile(r'\b(collection|pickup|pick.up|delivery).{0,30}(not happened|didn.t happen|failed|missed|overdue)\b', re.I),
     'confidence': 0.65},
    # Missing document / customs
    {'issueId': 'customs',           'state': 'missing',
     'pattern': re.compile(r'\b(no|missing|without|not received|not provided).{0,25}(doc|cert|form|paper|letter|permit|licence|license)\b', re.I),
     'confidence': 0.60},
    {'issueId': 'customs',           'state': 'missing',
     'pattern': re.compile(r'\b(document|paperwork|certificate|permit).{0,25}(missing|not|required|needed|wrong|incorrect|outstanding)\b', re.I),
     'confidence': 0.60},
    # Amendment / data correction
    {'issueId': 'amendment',         'state': 'amended',
     'pattern': re.compile(r'\b(wrong|incorrect|error|mistake|invalid).{0,25}(name|address|city|country|zip|postcode|weight|volume|quantity|number|code|date|port|routing)\b', re.I),
     'confidence': 0.65},
    {'issueId': 'amendment',         'state': 'amended',
     'pattern': re.compile(r'\b(please|kindly|need to).{0,25}(update|correct|change|amend|modify|fix|revise)\b', re.I),
     'confidence': 0.60},
    # Load / booking reference
    {'issueId': 'load_ref',          'state': 'missing',
     'pattern': re.compile(r'\b(no|without|missing|not provided|not received).{0,20}(reference|ref|booking number|order number|po number|load number|job number)\b', re.I),
     'confidence': 0.65},
    {'issueId': 'ref_provided',      'state': 'provided',
     'pattern': re.compile(r'\b(here is|find below|see below|as requested).{0,40}(reference|ref|booking number|order number|load number)\b', re.I),
     'confidence': 0.65},
    {'issueId': 'ref_provided',      'state': 'provided',
     # Must contain at least one digit to be a real reference value (not "is required" etc.)
     'pattern': re.compile(r'\b(?:load\s*ref(?:erence)?|booking\s*ref(?:erence)?|ref(?:erence)?)\s*(?:is|:|no\.?|#)\s*[A-Z0-9]*[0-9][A-Z0-9]{2,}', re.I),
     'confidence': 0.70},
    {'issueId': 'ref_provided',      'state': 'provided',
     'pattern': re.compile(r'\b(?:load\s*ref(?:erence)?|booking\s*ref(?:erence)?|reference)\b.{0,40}\b(?:attached|sent|forwarded|provided|below|herewith)\b', re.I),
     'confidence': 0.65},
    # T1 / transit
    {'issueId': 't1',                'state': 'missing',
     'pattern': re.compile(r'\bt[12]\b.{0,30}(missing|not received|not provided|not issued|outstanding|required)\b', re.I),
     'confidence': 0.65},
    {'issueId': 't1',                'state': 'delayed',
     'pattern': re.compile(r'\btransit.{0,20}(not closed|still open|not discharged|outstanding)\b', re.I),
     'confidence': 0.65},
    # Equipment release
    {'issueId': 'equipment_release', 'state': 'missing',
     'pattern': re.compile(r'\b(pin|release|acceptance).{0,25}(missing|not received|not working|expired|invalid|not issued)\b', re.I),
     'confidence': 0.65},
    {'issueId': 'equipment_release', 'state': 'provided',
     'pattern': re.compile(r'\b(pin|release code|release order).{0,30}(find below|see below|here is|attached|sent)\b', re.I),
     'confidence': 0.65},
    # Rate / billing
    {'issueId': 'rate',              'state': 'missing',
     'pattern': re.compile(r'\b(selfbilling|self.billing|selfbill|self.bill)\b', re.I),
     'confidence': 0.85},
    {'issueId': 'rate',              'state': 'missing',
     'pattern': re.compile(r'\bdch\s*(invoice|billing|report|cost)\b', re.I),
     'confidence': 0.85},
    {'issueId': 'rate',              'state': 'missing',
     'pattern': re.compile(r'\bextra\s*costs?\s*invoice\b', re.I),
     'confidence': 0.85},
    {'issueId': 'rate',              'state': 'missing',
     'pattern': re.compile(r'\b(demurrage|detention|storage)\s*invoice\b', re.I),
     'confidence': 0.80},
    {'issueId': 'rate',              'state': 'missing',
     'pattern': re.compile(r'\b(credit|debit)\s*(note|memo)\b', re.I),
     'confidence': 0.80},
    {'issueId': 'rate',              'state': 'missing',
     'pattern': re.compile(r'\b(invoice|billing|charge|cost|fee|price).{0,25}(query|wrong|issue|error|dispute|question|clarif)\b', re.I),
     'confidence': 0.60},
    {'issueId': 'rate',              'state': 'missing',
     'pattern': re.compile(r'\b(charged|billed).{0,25}(too much|incorrectly|wrong amount|double)\b', re.I),
     'confidence': 0.65},
    # Tracking
    {'issueId': 'tracking',          'state': 'missing',
     'pattern': re.compile(r'\b(where|when).{0,35}(shipment|cargo|parcel|goods|container|delivery|truck|driver)\b', re.I),
     'confidence': 0.60},
    {'issueId': 'tracking',          'state': 'missing',
     'pattern': re.compile(r'\b(no|without).{0,20}(tracking|trace|update|visibility|information|status|news)\b', re.I),
     'confidence': 0.60},
    # Communication
    {'issueId': 'communication',     'state': 'escalated',
     'pattern': re.compile(r'\b(no.one|nobody|no response|no reply|no answer|not respond|not reply|ignored|being ignored)\b', re.I),
     'confidence': 0.65},
    {'issueId': 'communication',     'state': 'escalated',
     'pattern': re.compile(r'\b(complaint|dissatisfied|unhappy|frustrated|escalat|unacceptable)\b', re.I),
     'confidence': 0.60},
    # Damage
    {'issueId': 'damage',            'state': 'missing',
     'pattern': re.compile(r'\b(goods|cargo|parcel|items?|products?|packages?).{0,35}(broken|damaged|missing|lost|stolen|wet|short|shortage)\b', re.I),
     'confidence': 0.65},
    # Equipment defect
    {'issueId': 'equipment',         'state': 'delayed',
     'pattern': re.compile(r'\b(container|trailer|truck|vehicle|unit|reefer).{0,35}(broken|damaged|defective|unavailable|failure|fault|breakdown)\b', re.I),
     'confidence': 0.60},
    # Waiting time
    {'issueId': 'waiting_time',      'state': 'delayed',
     'pattern': re.compile(r'\b(waiting|waited|standing|idle).{0,25}(hours?|days?|long time|since|for)\b', re.I),
     'confidence': 0.60},
    # Closing time
    {'issueId': 'closing_time',      'state': 'delayed',
     'pattern': re.compile(r'\b(missed|after|past|beyond).{0,25}(cutoff|cut-off|deadline|closing|gate|vessel)\b', re.I),
     'confidence': 0.65},
    # Portbase
    {'issueId': 'portbase',          'state': 'missing',
     'pattern': re.compile(r'\b(pre.arriv|port notif|ata notif|pcs mess)\b', re.I),
     'confidence': 0.60},
    # Pickup / delivery planning
    {'issueId': 'pickup_delivery',   'state': 'informational',
     'pattern': re.compile(r'\b(plan|confirm|arrange).{0,25}(pickup|pick.up|collection|delivery)\b', re.I),
     'confidence': 0.55},
    # Scheduling
    {'issueId': 'scheduling',        'state': 'missing',
     'pattern': re.compile(r'\b(slot|time.slot|appointment).{0,25}(needed|required|missing|not confirmed|not allocated)\b', re.I),
     'confidence': 0.55},
    # ── RECOVERY_SIGNALS patterns (integrated from unused RECOVERY_SIGNALS list) ──
    # Scheduling / timing
    {'issueId': 'scheduling', 'state': 'unknown',
     'pattern': re.compile(r'\b(what time will|confirm time|delivery window|morning delivery|afternoon delivery|morning slot|afternoon slot|arrival window|loading time|unloading time|what day will|which day will)\b', re.I),
     'confidence': 0.60},
    # Pickup / delivery arrangement
    {'issueId': 'pickup_delivery', 'state': 'unknown',
     'pattern': re.compile(r'\b(please arrange|please organise|please organize|need to arrange|requires delivery to|need delivery to|please book transport|arrange collection from|arrange delivery to|requesting transport|book transport|organize transport)\b', re.I),
     'confidence': 0.60},
    # Shipping advice
    {'issueId': 'shipping_advice', 'state': 'informational',
     'pattern': re.compile(r'\b(booking confirmed|booking acknowledgement|shipment confirmed|pre.?alert|arrival notice|departure notice|goods dispatched|goods shipped|shipped today|vessel departed|loaded on vessel)\b', re.I),
     'confidence': 0.60},
    # Waiting / demurrage
    {'issueId': 'waiting_time', 'state': 'unknown',
     'pattern': re.compile(r'\b(waiting at gate|waiting at terminal|driver waiting|truck waiting|free time expired|free days expired|per diem|storage accruing|demurrage accruing|futile trip|wasted journey|empty trip)\b', re.I),
     'confidence': 0.65},
    # Damage / shortage
    {'issueId': 'damage', 'state': 'unknown',
     'pattern': re.compile(r'\b(goods were damaged|arrived damaged|items missing|goods missing|short delivery|short shipment|partial delivery|not all items received|goods not received|incorrect quantity|cargo damage|damaged goods)\b', re.I),
     'confidence': 0.65},
    # Capacity / feasibility
    {'issueId': 'capacity', 'state': 'unknown',
     'pattern': re.compile(r'\b(is it possible to|can you do|can you handle|is there capacity|is it feasible|do you have space|slot available|is there a slot|can this be loaded)\b', re.I),
     'confidence': 0.60},
    # Equipment release / pin
    {'issueId': 'equipment_release', 'state': 'unknown',
     'pattern': re.compile(r'\b(release code|release pin|pin code|container pin|vbs pin|require pin|need pin|pin for|pin number|release number|collect container|container collection|pickup container|terminal release|port release|collect at terminal)\b', re.I),
     'confidence': 0.65},
    # BL related
    {'issueId': 'bl', 'state': 'unknown',
     'pattern': re.compile(r'\b(release cargo|cargo release|release shipment|surrender bl|telex release|cargo documents required|original documents required|draft bl|bl draft)\b', re.I),
     'confidence': 0.60},
    # VGM / weight
    {'issueId': 'vgm', 'state': 'unknown',
     'pattern': re.compile(r'\b(gross weight|gross mass|total weight|weight declaration|vgm declaration|weighing slip|weight slip|shipper weight|verified weight)\b', re.I),
     'confidence': 0.65},
    # Seal details
    {'issueId': 'seal', 'state': 'unknown',
     'pattern': re.compile(r'\b(seal no\.|seal nr|container seal|seal intact|seal broken|seal ok|seal check|seal discrepancy)\b', re.I),
     'confidence': 0.65},
    # Dangerous goods
    {'issueId': 'dangerous_goods', 'state': 'unknown',
     'pattern': re.compile(r'\b(un number|dg class|imo class|hazardous material|dangerous cargo|dg cargo|imdg|dg document|dangerous goods form|un no|adnr|regulated goods)\b', re.I),
     'confidence': 0.70},
    # Closing time / cutoff
    {'issueId': 'closing_time', 'state': 'unknown',
     'pattern': re.compile(r'\b(what is the cutoff|what is the closing|when is the cutoff|when is the closing|gate closes at|gate opening time|gate close time)\b', re.I),
     'confidence': 0.60},
    # Ref provided — direct provision
    {'issueId': 'ref_provided', 'state': 'provided',
     'pattern': re.compile(r'\b(reference update|updated ref|correct ref|ref below|please find the ref|load ref below|booking ref below|load ref provided|reference provided|ref has been sent)\b', re.I),
     'confidence': 0.65},
    # Communication / escalation
    {'issueId': 'communication', 'state': 'escalated',
     'pattern': re.compile(r'\b(chasing|following up|follow.up|no reply|no response|unanswered|third reminder|second reminder|first reminder|as per my previous|as per my email|did you receive|awaiting your response|urgent reminder|reminder email|this is a reminder)\b', re.I),
     'confidence': 0.60},
    # Amendment / correction — common patterns
    {'issueId': 'amendment', 'state': 'amended',
     'pattern': re.compile(r'\b(wrong address|incorrect address|address correction|address change|wrong name|incorrect name|name correction|correction needed|wrong details|incorrect details|mistake in|wrong date|incorrect date|error in booking)\b', re.I),
     'confidence': 0.65},
]

def _fallback_classify(text: str) -> dict | None:
    """Regex-based fallback. Returns best match or None."""
    best: dict | None = None
    for rule in _FALLBACK_RULES:
        if rule['pattern'].search(text):
            if not best or rule['confidence'] > best['confidence']:
                best = {'issueId': rule['issueId'], 'state': rule['state'],
                        'confidence': rule['confidence']}
    return best

_OPERATIONAL_CLUES = [
    ('shipment',   'tracking',          'unknown'),
    ('container',  'equipment',         'unknown'),
    ('transport',  'delay',             'unknown'),
    ('transit',    't1',                'unknown'),
    ('customs',    'customs',           'unknown'),
    ('document',   'customs',           'unknown'),
    ('certificate','customs',           'unknown'),
    ('invoice',    'rate',              'unknown'),
    ('driver',     'delay',             'unknown'),
    ('delivery',   'delay',             'unknown'),
    ('collection', 'delay',             'unknown'),
    ('amendment',  'amendment',         'amended'),
    ('schedule',   'scheduling',        'unknown'),
    ('slot',       'scheduling',        'unknown'),
    ('release',    'equipment_release', 'unknown'),
    ('damage',     'damage',            'unknown'),
    ('complaint',  'communication',     'escalated'),
]

def _operational_clue_scan(text: str) -> dict | None:
    t = text.lower()
    for keyword, issue_id, state in _OPERATIONAL_CLUES:
        if keyword in t:
            return {'issueId': issue_id, 'state': state, 'confidence': 0.50}
    return None


# ─────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────

def _clean_text(val: Any) -> str:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return ""
    return str(val).strip()


def _week_key(dt: Any) -> str:
    if dt is None or (isinstance(dt, float) and math.isnan(dt)):
        return ""
    try:
        if isinstance(dt, str):
            dt = pd.to_datetime(dt, errors="coerce")
        if pd.isna(dt):
            return ""
        iso = dt.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    except Exception:
        return ""


def _score_header(name: str) -> str | None:
    h = name.lower().strip()
    # Exact match
    for key, aliases in COLUMN_ALIASES.items():
        if h in aliases:
            return key
    # Partial match
    for key, aliases in COLUMN_ALIASES.items():
        for a in aliases:
            if a in h or h in a:
                return key
    return None


# ─── Financial subject early-exit patterns ────────────────────────
# When subject line contains these, force rate classification immediately.
_FINANCIAL_SUBJECT_PATTERNS: list[str] = [
    'extra costs report', 'extra cost report',
    'extra costs invoice', 'extra cost invoice',
    'extrakostenrechnung',
    'extra kosten rapport', 'extra kosten report',
    'meerkosten rapport', 'meerkosten report',
    'extra costs', 'extra cost', 'purchase order', 'po number',
    'storage costs', 'storage cost',
    # DCH / self-billing specific patterns (always financial)
    'dch invoice', 'dch billing', 'dch report', 'dch cost',
    'selfbilling', 'self billing', 'self-billing', 'selfbill', 'self bill',
    # Invoice / billing dispute in subject
    'billing dispute', 'invoice dispute', 'invoice query', 'billing query',
    'rate dispute', 'rate query', 'charge dispute', 'overcharge',
    'waiting time invoice', 'waiting costs invoice', 'storage invoice',
    'demurrage invoice', 'detention invoice',
    # Dutch
    'extra kosten', 'opslagkosten', 'wachttijd kosten', 'kosten rapport',
    'inkooporder', 'bestelnummer',
    # German
    'extrakosten', 'lagerkosten', 'standgeld', 'kostenbericht', 'bestellnummer',
    'po mismatch', 'po amount', 'po discrepancy', 'po bedrag', 'po betrag',
]

# Per-field weights (mirrors classifyCase.ts FIELD_WEIGHTS)
_FIELD_WEIGHTS: list[tuple[str, float]] = [
    ('description', 1.00),
    ('subject',     0.88),
    ('isr',         0.78),
    ('category',    0.70),
]

# load_ref from subject only gets 0.30 weight (avoids false positives in billing emails)
_LOAD_REF_SUBJECT_WEIGHT = 0.30

# ─────────────────────────────────────────────────────────────────
# INTENT PRIORITY SYSTEM (ported from intentDetection.ts)
# Higher priority (lower number) overrides lower priority when
# a strong match (≥ STRONG_INTENT_THRESHOLD) exists.
# ─────────────────────────────────────────────────────────────────

_INTENT_PRIORITY: dict[str, int] = {
    'financial':     1,
    'equipment':     2,
    'planning':      3,
    'documentation': 4,
    'operational':   5,
    'tracking':      6,
    'communication': 7,
    'reference':     8,
}

_TOPIC_INTENT: dict[str, str] = {
    'rate':             'financial',
    'damage':           'financial',
    'waiting_time':     'financial',
    'equipment':        'equipment',
    'equipment_release':'equipment',
    # planning group (matches intentDetection.ts exactly)
    'amendment':        'operational',
    'capacity':         'planning',
    'scheduling':       'planning',
    'pickup_delivery':  'planning',
    'transport_order':  'planning',    # frontend: planning (not documentation)
    'closing_time':     'planning',    # frontend: planning
    # documentation group
    'customs':          'documentation',
    't1':               'documentation',
    'portbase':         'documentation',
    'bl':               'documentation',
    'vgm':              'documentation',
    'dangerous_goods':  'documentation',
    # operational group
    'delay':            'operational',
    'seal':             'operational',  # frontend: operational (not reference)
    # tracking group
    'tracking':         'tracking',
    'shipping_advice':  'tracking',    # frontend: tracking (not reference)
    # communication group
    'communication':    'communication',
    # reference group (lowest priority — informational)
    'load_ref':         'reference',
    'ref_provided':     'reference',
    'other':            'operational',
}

_STRONG_INTENT_THRESHOLD = 0.75

_FINANCIAL_GUARD_KEYWORDS: list[str] = [
    # Self-billing / DCH (always financial, never customs/reference)
    'selfbilling', 'self billing', 'self-billing', 'selfbill', 'self bill',
    'dch invoice', 'dch billing', 'dch report',
    # Extra costs — all variants
    'extra cost invoice', 'extra costs invoice',
    'extra costs report', 'extra cost report', 'extrakostenrechnung',
    'extra kosten rapport', 'extra kosten report',
    'meerkosten rapport', 'meerkosten report',
    # Billing specifics
    'billing report', 'billing dispute', 'billing issue', 'billing error',
    'cost invoice', 'waiting cost invoice', 'waiting costs invoice',
    # Storage and waiting-time financial charges
    'demurrage invoice', 'detention invoice', 'storage invoice',
    'storage cost invoice', 'storage costs invoice',
    # Credit / debit notes
    'credit note', 'credit memo', 'debit note', 'debit memo',
    # Invoice / charge disputes
    'invoice query', 'invoice dispute', 'invoice incorrect', 'invoice error',
    'charge dispute', 'billing query',
    'overcharged', 'overcharge',
    # PO mismatches
    'po amount mismatch', 'po mismatch', 'po discrepancy', 'po bedrag',
    'po betrag', 'po abweichung', 'po differenz',
    # Cost allocation
    'cost allocation', 'kosten rapport', 'kostenbericht',
    # Other languages
    'wachttijd kosten', 'opslagkosten', 'wartezeit kosten',
    'lagerkosten', 'meerkosten',
]


def _filter_by_intent_priority(matches: list[dict]) -> list[dict]:
    """
    Suppress lower-priority-intent topics when a strong higher-priority match exists.
    Mirrors filterByIntentPriority() in intentDetection.ts.
    If any topic has confidence ≥ 0.75, suppress all lower-priority-intent topics.
    """
    if not matches:
        return matches
    # Find best priority (lowest number) among strong matches
    best_priority = 999
    for m in matches:
        if m['confidence'] >= _STRONG_INTENT_THRESHOLD:
            intent = _TOPIC_INTENT.get(m['issueId'], 'operational')
            priority = _INTENT_PRIORITY.get(intent, 9)
            if priority < best_priority:
                best_priority = priority
    if best_priority == 999:
        return matches  # No strong match → no filtering
    # Keep only matches whose intent priority ≤ best_priority
    filtered = [
        m for m in matches
        if _INTENT_PRIORITY.get(_TOPIC_INTENT.get(m['issueId'], 'operational'), 9) <= best_priority
    ]
    return filtered if filtered else matches


def _has_strong_financial_context(text: str) -> bool:
    """
    True if text contains any financial keyword (mirrors hasStrongFinancialContext()
    in intentDetection.ts — uses ANY match, not multiple matches).
    """
    t = text.lower()
    return any(kw in t for kw in _FINANCIAL_GUARD_KEYWORDS)


# ─────────────────────────────────────────────────────────────────
# LOAD REF STRICT GATE (ported from loadRefGuards.ts)
# ─────────────────────────────────────────────────────────────────

# Explicit phrases that unambiguously mean a load ref is absent
# Full list ported from LOAD_REF_EXPLICIT_MISSING in loadRefGuards.ts
_LOAD_REF_EXPLICIT_MISSING: list[str] = [
    # English — load ref variants
    'missing load ref', 'missing load reference', 'load ref missing', 'load reference missing',
    'no load ref', 'no load reference', 'load ref not provided', 'load reference not provided',
    'load ref not received', 'load reference not received', 'load ref required',
    'load reference required', 'load ref needed', 'load reference needed',
    'load ref absent', 'load ref not visible', 'load ref not in system',
    'please provide load ref', 'please provide load reference',
    'please add load ref', 'please add load reference',
    'please add the load ref', 'please add the load reference',
    'please send load ref', 'please send load reference',
    'please send the loadref', 'please send the loadrefs', 'please send loadref',
    'can you send the load ref', 'can you provide load ref',
    'loadref missing', 'loadref not provided', 'loadref not received',
    'please provide loadref', 'please send loadref', 'loadref still missing',
    'no load ref received', 'loadref required', 'no loadref', 'load ref not',
    # English — booking ref variants
    'booking ref missing', 'booking reference missing',
    'booking ref not provided', 'booking reference not provided',
    'booking ref required', 'booking reference required',
    'missing booking ref', 'missing booking reference',
    'please provide booking ref', 'please provide booking reference',
    'please add booking ref', 'please add booking reference',
    # English — release / loading ref
    'missing release reference', 'release ref missing',
    'please provide release ref', 'loading reference missing', 'loading ref missing',
    'reference required for loading', 'ref required for loading', 'ref required for pickup',
    'driver needs load ref', 'driver requires load ref',
    # Dutch
    'laadreferentie ontbreekt', 'loadref ontbreekt', 'graag loadref sturen',
    'graag laadreferentie sturen', 'loadref nog niet ontvangen',
    'laadreferentie niet ontvangen', 'graag de loadref', 'loadref nog niet',
    'laadreferentie nog niet', 'zonder laadreferentie', 'chauffeur heeft referentie nodig',
    'referentie ontbreekt', 'geen referentie ontvangen', 'graag de laadreferentie',
    'laadreferentie missen', 'ontbrekende laadreferentie', 'referentie voor laden nodig',
    'laadreferentie ontbr',
    # German
    'ladereferenz fehlt', 'lade referenz fehlt', 'bitte ladereferenz senden',
    'referenz fehlt', 'ladung referenz fehlt', 'ladereferenz nicht erhalten',
    'ladereferenz wird benoetigt', 'ladereferenz benoetigt', 'ladereferenz nicht vorhanden',
    'fehlende ladereferenz', 'ohne ladereferenz', 'fahrer braucht referenz',
    'keine referenz erhalten', 'bitte referenz senden',
    'ladereferenz noch nicht erhalten', 'referenz fehlt für ladung',
]

# Phrases that indicate this is NOT a load_ref case (billing/planning/routing context)
# Full list ported from LOAD_REF_PLANNING_BLOCKLIST in loadRefGuards.ts
_LOAD_REF_PLANNING_BLOCKLIST: list[str] = [
    # Billing / financial
    'invoice', 'billing', 'selfbilling', 'self billing', 'self-billing',
    'extra costs', 'extra cost', 'storage costs', 'storage cost',
    'waiting time', 'demurrage', 'detention', 'credit note', 'debit note',
    'purchase order', 'po number', 'po no', 'quotation', 'surcharge',
    'rate discussion', 'rate query', 'rate inquiry', 'cost report',
    # Routing / planning
    'routing', 'route planning', 'intermodal feasibility', 'loading feasibility',
    'booking feasibility', 'feasibility', 'capacity request', 'capacity',
    'rail cut', 'barge schedule', 'rail slot', 'barge slot',
    'preferred load date', 'preferred loaddate', 'advise load date', 'advise loaddate',
    'advise intermodal', 'advise rail', 'loading window', 'operational planning',
    'slot allocation', 'slot booking', 'slot request', 'loading slot',
    'allocation request', 'intermodal request',
    # Status / tracking
    'proof of delivery', 'tracking',
    # Work order context (not the same as missing load ref)
    'work order', 'workorder',
    # Questions about whether load ref is needed (not actually missing)
    'do we need load ref', 'do we need a load ref', 'do we need the load ref',
    'is load ref required', 'is a load ref required', 'is the load ref required',
    'is load reference required', 'do you require load ref', 'do you need load ref',
    'will you need load ref',
]

# Regex patterns that detect explicitly-provided reference values (textProvidesRef)
# Full list ported from PROVIDED_REF_PATTERNS in loadRefGuards.ts
_PROVIDED_REF_PATTERNS: list[re.Pattern] = [
    # Explicit value follows keyword: "load ref is ABC123" / "ref: ABC123"
    re.compile(r'\b(?:load\s*ref(?:erence)?|loadref|laadreferentie|ladereferenz|booking\s*ref(?:erence)?|ref(?:erence)?)\s*(?:is|are|was|:)\s*(?=[A-Z0-9]*[0-9][A-Z0-9]*)[A-Z0-9]{4,}', re.I),
    # Reference number pattern: "reference no. ABC123"
    re.compile(r'\b(?:reference|load\s*ref|booking\s*ref)\s*(?:no\.?\s*|#\s*|:\s*)[A-Z0-9]{4,}', re.I),
    # "ref no. ABC123"
    re.compile(r'\bref(?:erence)?\s+no\.?\s*[A-Z0-9]{4,}', re.I),
    # See/find below followed by ref mention
    re.compile(r'\b(?:see|find)\s+below.{0,80}(?:ref(?:erence)?|load|booking)\b', re.I),
    re.compile(r'\b(?:ref(?:erence)?|load|booking).{0,60}(?:see|find)\s+below\b', re.I),
    # "below is the load ref"
    re.compile(r'\bbelow\s+is\s+the\s+(?:load\s*)?(?:ref(?:erence)?|booking\s*ref)\b', re.I),
    # "find the ref below"
    re.compile(r'\b(?:find|see)\s+the\s+(?:load\s*)?ref(?:erence)?\s+below\b', re.I),
    # Attached/herewith followed by ref mention
    re.compile(r'\b(?:attached|herewith|find\s+enclosed|please\s+find\s+attached).{0,80}(?:ref(?:erence)?|load|booking)\b', re.I),
    # Ref...attached/sent (with negative lookbehind for "not")
    re.compile(r'\b(?:ref(?:erence)?|load\s*ref|booking\s*ref).{0,60}(?<!not\s)(?:attached|enclosed|herewith|sent|forwarded|provided)\b', re.I),
    # "correct/corrected/updated ref"
    re.compile(r'\bcorrect(?:ed)?\s+(?:load\s*)?(?:ref(?:erence)?|booking\s*ref)\b', re.I),
    re.compile(r'\bupdat(?:ed?|ing)\s+(?:the\s+)?(?:load\s*)?(?:ref(?:erence)?|booking\s*ref)\b', re.I),
    # "ref confirmed"
    re.compile(r'\b(?:load\s*ref|booking\s*ref|ref(?:erence)?)\s+confirmed\b', re.I),
    # "the correct ref"
    re.compile(r'\bthe\s+correct\s+(?:load\s*)?(?:ref(?:erence)?|booking\s*ref)\b', re.I),
    # "ref has been updated/provided/sent"
    re.compile(r'\b(?:ref(?:erence)?|load\s*ref|booking\s*ref)\s+(?:has\s+been|was|have\s+been)\s+(?:updated|provided|sent|forwarded|attached|confirmed|shared)\b', re.I),
    # "the load ref is..." with negative lookahead for missing/absent
    re.compile(r'\bthe\s+(?:load\s*)?ref(?:erence)?\s+is\b(?!\s*(?:missing|absent|not|required|needed|still|unknown|unavailable|incorrect|wrong|invalid))', re.I),
    # "load ref below"
    re.compile(r'\b(?:load\s*ref|booking\s*ref|ref(?:erence)?)\s+below\b', re.I),
    # Simple colon patterns
    re.compile(r'ref\s*:\s*[A-Z0-9]{4,}', re.I),
    re.compile(r'loadref\s*:\s*[A-Z0-9]{3,}', re.I),
    # Generic alphanumeric ref value after keyword
    re.compile(r'\b(?:load\s*ref(?:erence)?|loadref|booking\s*ref(?:erence)?|ref(?:erence)?)\s*'
               r'(?:is|:|no\.?|#)?\s*[A-Z0-9]*[0-9][A-Z0-9]{3,}', re.I),
]


def _text_provides_ref(text: str) -> bool:
    """Returns True if text explicitly provides a reference value."""
    return any(p.search(text) for p in _PROVIDED_REF_PATTERNS)


_BILLING_INTENT_SIGNALS: list[str] = [
    'demurrage', 'detention', 'extra cost', 'extra costs', 'additional charge',
    'surcharge', 'cost report', 'rate discussion', 'rate query', 'rate inquiry',
    'invoice', 'waiting costs', 'charges report', 'rate', 'billing', 'charge',
    'storage cost', 'storage costs', 'credit note', 'debit note', 'purchase order',
    'po number', 'selfbill', 'self bill', 'selfbilling', 'overcharge',
]

_PLANNING_INTENT_SIGNALS: list[str] = [
    'feasibility', 'capacity request', 'rail cut', 'barge schedule',
    'preferred load date', 'preferred loaddate', 'advise load date', 'advise loaddate',
    'advise intermodal', 'advise rail', 'loading window', 'operational planning',
    'slot allocation', 'slot booking', 'slot request', 'rail slot', 'barge slot',
    'loading slot', 'allocation request', 'intermodal request', 'capacity',
]

_ROUTING_INTENT_SIGNALS: list[str] = [
    'routing', 'route planning', 'route change', 'routing check',
]


def _detect_body_intent(text: str) -> str:
    """
    Detect if body has billing/planning/routing intent (used in load_ref gate).
    Mirrors detectBodyIntent() in loadRefGuards.ts — checks individual signals.
    """
    t = text.lower()
    if any(s in t for s in _BILLING_INTENT_SIGNALS):
        return 'billing'
    if any(s in t for s in _PLANNING_INTENT_SIGNALS):
        return 'planning'
    if any(s in t for s in _ROUTING_INTENT_SIGNALS):
        return 'routing'
    return 'unknown'


def _validate_load_ref_missing(subject: str, description: str, isr: str) -> bool:
    """
    7-step strict gate for load_ref classification.
    Returns True only if this is clearly a 'missing load ref' case.
    Mirrors validateLoadRefMissing() in loadRefGuards.ts.
    """
    combined = ' '.join(filter(None, [description, subject, isr])).lower()

    # Step 1: Must have an explicit missing phrase
    if not any(phrase in combined for phrase in _LOAD_REF_EXPLICIT_MISSING):
        return False

    # Step 2: If body explicitly provides a reference value → ref_provided, not load_ref
    if _text_provides_ref(combined):
        return False

    # Step 3: Body intent check — billing/planning context → reject
    body_intent = _detect_body_intent(combined)
    if body_intent in ('billing', 'planning'):
        return False

    # Step 4: Subject-line planning/billing blocklist check
    subj_lower = (subject or '').lower()
    if any(phrase in subj_lower for phrase in _LOAD_REF_PLANNING_BLOCKLIST):
        return False

    # Step 5: Multiple planning/billing keywords in full text → reject
    blocklist_hits = sum(1 for phrase in _LOAD_REF_PLANNING_BLOCKLIST if phrase in combined)
    if blocklist_hits >= 3:
        return False

    return True


# ─────────────────────────────────────────────────────────────────
# DOC PROVISION GUARD (ported from classifyCase.ts)
# customs/t1/bl/portbase + provision language → ref_provided
# ─────────────────────────────────────────────────────────────────

_DOC_TOPICS_STRICT: set[str] = {'customs', 't1', 'portbase', 'bl'}

_PROVIDED_DOC_PATTERNS: list[re.Pattern] = [
    # "please find / find attached / see attached ... t1/customs/mrn"
    re.compile(r'\b(?:please\s+find|find\s+attached|see\s+attached|herewith|attached\s+please\s+find|i\s+have\s+attached|we\s+have\s+attached).{0,80}(?:customs|t1|transit|portbase|bl|document|cert|declaration|mrn)', re.I),
    # "t1/mrn/customs ... attached/below/herewith/sent"
    re.compile(r'\b(?:customs|t1|transit\s+doc|portbase|bl|bill\s+of\s+lading|mrn|certificate|declaration).{0,80}(?:attached|below|herewith|forwarded|sent|provided|find\s+below|see\s+below|bijgevoegd|im\s+anhang|beigef)', re.I),
    # "as requested" + doc mention
    re.compile(r'\b(?:as\s+requested|as\s+per\s+your\s+request|as\s+per\s+request).{0,100}(?:customs|t1|portbase|bl|document|declaration|mrn)', re.I),
    # "sending/forwarding/attaching" + doc
    re.compile(r'\b(?:sending|forwarding|attaching|sharing|hereby\s+attach).{0,60}(?:customs|t1|portbase|bl|document|declaration|certificate|mrn)', re.I),
    # Specific string matches from classifyCase.ts PROVIDED_DOC_PATTERNS
    re.compile(r'\battached\s+t1\b', re.I),
    re.compile(r'\bplease\s+find\s+attached\s+t1\b', re.I),
    re.compile(r'\bmrn\s+attached\b', re.I),
    re.compile(r'\bsee\s+attached\s+customs\b', re.I),
    re.compile(r'\bforwarding\s+t1\b', re.I),
    re.compile(r'\bsending\s+customs\b', re.I),
    re.compile(r'\bcustoms\s+documents\s+attached\b', re.I),
    re.compile(r'\bplease\s+find\s+the\s+(?:t1|mrn)\b', re.I),
    re.compile(r'\b(?:mrn|t1)\s+(?:below|number\s+below|is(?!\s*(?:missing|absent|not\s|required|needed|still\s|wrong|incorrect|unavailable)))\b', re.I),
    re.compile(r'\bthe\s+mrn\s+is\b(?!\s*(?:missing|absent|not\s|required|needed|still\s|wrong|incorrect|unavailable))', re.I),
    re.compile(r'\bfind\s+attached\s+mrn\b', re.I),
    re.compile(r'\bplease\s+find\s+attached\s+mrn\b', re.I),
    # Dutch
    re.compile(r'\bt1\s+bijgevoegd\b', re.I),
    re.compile(r'\b(?:zie\s+bijgevoegd|mrn\s+bijgevoegd|douane\s+documenten\s+bijgevoegd)\b', re.I),
    # German
    re.compile(r'\bt1\s+im\s+anhang\b', re.I),
    re.compile(r'\b(?:mrn\s+beigef|zolldokumente\s+im\s+anhang)\b', re.I),
]

_PLANNING_CONTEXT_PHRASES: list[str] = [
    'feasibility', 'intermodal feasibility', 'loading feasibility', 'booking feasibility',
    'capacity', 'capacity request', 'can you handle', 'is it possible',
    'do you have capacity', 'is there capacity', 'slot available', 'slot availability',
    'routing', 'route request', 'route planning', 'routing check',
    'can you book', 'is there space', 'available capacity', 'no slots available',
    'rail cut', 'barge schedule', 'rail slot', 'barge slot',
    'preferred load date', 'loading window', 'operational planning',
    'intermodal request', 'advise load date', 'advise intermodal',
]

_DOC_MISSING_PHRASES: list[str] = [
    'missing', 'not received', 'not provided', 'not yet received', 'please send',
    'please provide', 'required', 'needed', 'outstanding', 'absent',
    'ontbreekt', 'fehlt', 'niet ontvangen', 'nicht erhalten',
]


def _doc_provision_detected(text: str) -> bool:
    """True if text explicitly provides a customs/t1/bl/portbase document."""
    return any(p.search(text) for p in _PROVIDED_DOC_PATTERNS)


def _has_planning_context(text: str) -> bool:
    t = text.lower()
    return any(p in t for p in _PLANNING_CONTEXT_PHRASES)


def _has_doc_missing_language(text: str) -> bool:
    t = text.lower()
    return any(p in t for p in _DOC_MISSING_PHRASES)


# Subject-only confidence penalty (mirrors classifyCase.ts constants)
_SUBJECT_ONLY_PENALTY    = 0.18
_SUBJECT_ONLY_FLOOR      = 0.48
_SUBSTANTIVE_DESC_MIN    = 30

# ── Post-classification guard constants (mirrors classifyCase.ts guards) ──────

_OPERATIONAL_CONTEXT_KEYWORDS: list[str] = [
    'haulier', 'hauler', 'driver', 'truck', 'lorry', 'transporter', 'carrier',
    'forwarder', 'freight forwarder', 'customs agent', 'customs broker',
    'container', 'cntr', 'pickup', 'pick up', 'pick-up', 'delivery',
    'collect', 'collection', 'loading', 'unloading', 'discharge',
    'terminal', 'depot', 'warehouse', 'gate out', 'gate in',
    'blocked', 'held', 'on hold', 'clearance', 'release', 'cargo',
    'shipment', 'freight', 'transport order', 'movement',
]

_EQUIPMENT_OVERRIDE_SIGNALS: list[str] = [
    'portable not ok', 'container damaged', 'damaged container',
    'equipment issue', 'reefer issue', 'seal broken', 'container not ok',
    'container defect', 'container beschadigd', 'container defekt',
    'unit not ok', 'equipment not ok', 'trailer not ok',
]

_MISSING_DOC_OVERRIDE_SIGNALS: list[str] = [
    'missing customs docs portbase', 'customs documents in portbase missing',
    'portbase customs missing', 'portbase customs docs missing',
    'missing customs docs', 'customs documents missing',
    't1 missing', 'missing t1', 'mrn missing', 'missing mrn',
]

_FINANCIAL_CHARGE_SIGNALS: list[str] = [
    'invoice', 'factuur', 'rechnung', 'charge', 'cost', 'kosten',
    'costs', 'billing', 'payment', 'betaling', 'rechnen',
]

_STRONG_TIMING_FAILURE_SIGNALS: list[str] = [
    'truck not arriving', 'barge delay', 'train delay', 'missed vessel',
    'missed cutoff', 'missed cco', 'driver delayed', 'arrival delay',
    'container late', 'not on time', 'late delivery', 'late arrival',
    'late pickup', 'vertraging', 'vertraagd', 'verspätung', 'verspätet',
    'niet op tijd', 'nicht pünktlich', 'rollover',
    'delayed', 'overdue', 'behind schedule', 'no show', 'not arrived',
    'late collection', 'not collected', 'not delivered', 'running late',
    'past eta', 'missed appointment', 'driver late', 'vehicle delayed',
    'truck delayed', 'failed delivery', 'failed collection',
    'missed time slot', 'delivery window missed',
]

_TRANSPORT_STATUS_PATTERNS: list[str] = [
    'transport status', 'shipment status', 'status update', 'transport update',
    'update transport', 'statusmeldung', 'transportmeldung', 'sendungsstatus',
]

_EXPLICIT_DELAY_SIGNALS: list[str] = [
    'delayed', 'delay', 'vertraging', 'vertraagd', 'verspätung', 'verspätet',
    'not loaded', 'niet geladen', 'nicht geladen',
    'rollover', 'missed cutoff', 'cutoff gemist', 'cutoff verpasst',
    'failed pickup', 'unable to deliver', 'niet afgeleverd', 'nicht zugestellt',
    'overdue', 'not on time', 'behind schedule', 'late arrival',
    'late delivery', 'missed eta', 'no show', 'not arrived',
]


def _find_trigger_signal(text: str, issue_id: str) -> str:
    """Return the strongest signal phrase from text relevant to issue_id."""
    t = text.lower()
    # For ref_provided, search doc topics that fork to it
    search_topics: list[str] = []
    if issue_id == 'ref_provided':
        search_topics = ['load_ref', 'customs', 't1', 'portbase', 'bl']
    else:
        search_topics = [issue_id]

    for rule in _TOPIC_RULES:
        if rule['topic'] not in search_topics:
            continue
        for sig in rule['strong']:
            if sig in t:
                return sig
        for sig in rule['weak']:
            if sig in t:
                return sig

    # Rate: check financial subject patterns
    if issue_id == 'rate':
        for pat in _FINANCIAL_SUBJECT_PATTERNS:
            if pat in t:
                return pat

    # Check fallback rules
    for fb_rule in _FALLBACK_RULES:
        if fb_rule['issueId'] == issue_id:
            m = fb_rule['pattern'].search(text)
            if m:
                return m.group(0)[:80]

    # Operational clue keywords
    for keyword, mapped_id, _ in _OPERATIONAL_CLUES:
        if mapped_id == issue_id and keyword in t:
            return keyword

    return ''


def _classify_row(subject: str, description: str, isr: str, category: str) -> dict:
    """
    Classify a single row. Returns full diagnostic dict including:
    primaryIssue, secondaryIssue, issueState, confidence, reviewFlag,
    detectedIntent, detectedObject, triggerPhrase, triggerSourceField,
    evidence, sourceFieldsUsed, fallbackUsed, unresolvedReason.
    """
    fields: dict[str, str] = {
        'description': description or '',
        'subject':     subject or '',
        'isr':         isr or '',
        'category':    category or '',
    }

    source_fields_used = [k for k, v in fields.items() if v.strip()]
    fallback_used = False
    ranked: list[dict] = []

    # ── inline helper to build final result dict ─────────────────────
    def _build(primary_issue: str, state: str, conf: float,
               fb_used: bool = False, rnk: list[dict] | None = None) -> dict:
        nonlocal fallback_used
        fallback_used = fb_used
        # Confidence assertion
        assert 0.0 <= conf <= 1.0, f"Confidence {conf} out of range 0–1 for issue {primary_issue}"

        review_flag = conf < REVIEW_FLAG_THRESHOLD

        # Secondary issue — first ranked result that differs from primary
        secondary = None
        for m in (rnk or []):
            if m['issueId'] != primary_issue:
                secondary = m['issueId']
                break

        detected_intent = _TOPIC_INTENT.get(primary_issue, 'unknown')
        detected_object = DETECTED_OBJECT_MAP.get(primary_issue, '')

        # Trigger phrase — search best field for primary issue signals
        trigger_phrase = ''
        trigger_source = ''
        for field_key, _ in _FIELD_WEIGHTS:
            txt = fields[field_key]
            if not txt.strip():
                continue
            phrase = _find_trigger_signal(txt, primary_issue)
            if phrase:
                trigger_phrase = phrase
                trigger_source = field_key
                break

        # Evidence trail
        evidence: list[str] = []
        if trigger_phrase and trigger_source:
            evidence.append(f'[{trigger_source}] strong signal: "{trigger_phrase}"')
        if fb_used:
            evidence.append(f'fallback: {primary_issue}')
        if primary_issue == 'other':
            evidence.append('no classification signals found')

        # Unresolved reason
        unresolved: str | None = None
        if primary_issue == 'other':
            unresolved = 'No classification signals found in available fields'
        elif conf < REVIEW_FLAG_THRESHOLD:
            unresolved = f'Low confidence ({conf:.0%}) — manual review needed'

        return {
            'primaryIssue':       primary_issue,
            'secondaryIssue':     secondary,
            'issueState':         state,
            'confidence':         round(conf, 4),
            'reviewFlag':         review_flag,
            'detectedIntent':     detected_intent,
            'detectedObject':     detected_object,
            'triggerPhrase':      trigger_phrase,
            'triggerSourceField': trigger_source,
            'evidence':           evidence,
            'sourceFieldsUsed':   source_fields_used,
            'fallbackUsed':       fb_used,
            'unresolvedReason':   unresolved,
        }

    # 1. Direct category column mapping (highest confidence, bypasses scoring)
    if category:
        cat_key = category.lower().strip()
        if cat_key in CATEGORY_MAP:
            mapped = CATEGORY_MAP[cat_key]
            combined = ' '.join(filter(None, [description, subject, isr]))
            state = _detect_state_windowed(combined)
            return _build(mapped, state, 0.88)

    # 2. Financial subject early-exit — unambiguous financial subjects override everything
    subj_lower = subject.lower()
    for pat in _FINANCIAL_SUBJECT_PATTERNS:
        if pat in subj_lower:
            return _build('rate', 'unknown', 0.92)

    # 3. Per-field weighted classification
    match_map: dict[str, dict] = {}

    for field_key, weight in _FIELD_WEIGHTS:
        field_text = fields[field_key]
        if not field_text.strip():
            continue
        field_matches = _classify_by_rules(field_text)
        for m in field_matches:
            eff_weight = _LOAD_REF_SUBJECT_WEIGHT if (field_key == 'subject' and m['issueId'] == 'load_ref') else weight
            weighted_conf = min(m['confidence'] * eff_weight, 0.98)
            existing = match_map.get(m['issueId'])
            if not existing or weighted_conf > existing['confidence']:
                match_map[m['issueId']] = {**m, 'confidence': weighted_conf, '_field': field_key}

    # Fall back to combined text if no per-field matches
    if not match_map:
        normalized = ' '.join(filter(None, [description, subject, isr, category]))
        for m in _classify_by_rules(normalized):
            match_map[m['issueId']] = m

    ranked = sorted(match_map.values(), key=lambda m: m['confidence'], reverse=True)

    # 4. filterByIntentPriority
    ranked = _filter_by_intent_priority(ranked)

    if ranked:
        best = ranked[0]
        issue_id   = best['issueId']
        state      = best['state']
        confidence = best['confidence']

        # 4b. State fallback — if windowed state is unknown, scan full combined text
        if state == 'unknown':
            combined_for_state = ' '.join(filter(None, [description, subject, isr]))
            state = _detect_state_windowed(combined_for_state)

        # 5. Subject-only penalty
        desc_is_substantive = len((description or '').strip()) >= _SUBSTANTIVE_DESC_MIN
        isr_has_content = len((isr or '').strip()) > 10
        if not desc_is_substantive and not isr_has_content and best.get('_field') == 'subject':
            confidence = max(confidence - _SUBJECT_ONLY_PENALTY, _SUBJECT_ONLY_FLOOR)

        # 6. Description-first override
        if desc_is_substantive:
            desc_matches = _classify_by_rules(description)
            desc_matches = _filter_by_intent_priority(desc_matches)
            if desc_matches:
                desc_primary = desc_matches[0]
                topics_differ = (
                    desc_primary['issueId'] != issue_id and
                    not (desc_primary['issueId'] == 'ref_provided' and issue_id == 'load_ref') and
                    not (desc_primary['issueId'] == 'load_ref'    and issue_id == 'ref_provided')
                )
                desc_intent_p = _INTENT_PRIORITY.get(_TOPIC_INTENT.get(desc_primary['issueId'], 'operational'), 9)
                curr_intent_p = _INTENT_PRIORITY.get(_TOPIC_INTENT.get(issue_id, 'operational'), 9)
                intent_allows_override = desc_intent_p <= curr_intent_p
                if topics_differ and desc_primary['confidence'] >= 0.55 and intent_allows_override:
                    issue_id   = desc_primary['issueId']
                    state      = desc_primary['state']
                    confidence = min(desc_primary['confidence'], confidence + 0.05)

        # 7. validateLoadRefMissing strict gate
        if issue_id == 'load_ref':
            if not _validate_load_ref_missing(subject, description, isr):
                body = ' '.join(filter(None, [description, subject, isr]))
                if _text_provides_ref(body):
                    return _build('ref_provided', 'provided', 0.72, rnk=ranked)
                remaining = [m for m in ranked if m['issueId'] != 'load_ref']
                if remaining:
                    issue_id   = remaining[0]['issueId']
                    state      = remaining[0]['state']
                    confidence = remaining[0]['confidence']
                else:
                    issue_id = None  # Fall through to fallback

        if issue_id:
            # 8. load_ref → ref_provided when body explicitly provides a ref value
            if issue_id == 'load_ref':
                body = ' '.join(filter(None, [description, subject, isr]))
                if _text_provides_ref(body):
                    issue_id = 'ref_provided'
                    state    = 'provided'

            # 9. ref_provided wins over load_ref
            if 'ref_provided' in match_map and issue_id == 'load_ref':
                issue_id = 'ref_provided'
                state    = 'provided'

            # 10. Doc provision guard — customs/t1/bl/portbase + provision language → ref_provided
            if issue_id in _DOC_TOPICS_STRICT:
                body = ' '.join(filter(None, [description, subject, isr]))
                if _doc_provision_detected(body):
                    issue_id   = 'ref_provided'
                    state      = 'provided'
                    confidence = 0.72

            # 11. Planning compliance guard
            if issue_id in _DOC_TOPICS_STRICT:
                body = ' '.join(filter(None, [description, subject, isr]))
                if _has_planning_context(body) and not _has_doc_missing_language(body):
                    confidence = max(confidence - 0.25, 0.30)
                    if confidence <= 0.35:
                        remaining = [m for m in ranked if m['issueId'] not in _DOC_TOPICS_STRICT]
                        if remaining:
                            issue_id   = remaining[0]['issueId']
                            state      = remaining[0]['state']
                            confidence = remaining[0]['confidence']

            # 12. Customs operational context check — soft penalty when no
            # transporter or operational movement context (mirrors classifyCase.ts §Section 3)
            if issue_id in _DOC_TOPICS_STRICT:
                body_ctx = ' '.join(filter(None, [description, subject, isr])).lower()
                if not any(kw in body_ctx for kw in _OPERATIONAL_CONTEXT_KEYWORDS):
                    confidence = max(confidence - 0.15, 0.30)

            # 13. FIX E: ref_provided sanity check — override when stronger signal detected
            if issue_id == 'ref_provided':
                body_sane = ' '.join(filter(None, [description, subject, isr])).lower()
                if _has_strong_financial_context(body_sane):
                    issue_id   = 'rate'
                    confidence = max(confidence, 0.80)
                elif any(s in body_sane for s in _EQUIPMENT_OVERRIDE_SIGNALS):
                    issue_id   = 'equipment'
                    confidence = max(confidence, 0.80)
                elif any(s in body_sane for s in _MISSING_DOC_OVERRIDE_SIGNALS):
                    has_portbase = 'portbase' in body_sane and 'customs' in body_sane
                    issue_id   = 'customs' if (has_portbase or 't1' not in body_sane) else 't1'
                    state      = 'missing'
                    confidence = max(confidence, 0.80)

            # 14. GAP C: waiting_time + financial charge language → rate
            if issue_id == 'waiting_time':
                body_wt = ' '.join(filter(None, [description, subject, isr])).lower()
                if any(s in body_wt for s in _FINANCIAL_CHARGE_SIGNALS):
                    issue_id   = 'rate'
                    confidence = max(confidence, 0.78)

            # 15. FIX B: closing_time + customs + missing → customs
            if issue_id == 'closing_time':
                body_ct = ' '.join(filter(None, [description, subject, isr])).lower()
                has_customs_kw = any(kw in body_ct for kw in ('customs', 'douane', 'zoll'))
                has_missing_kw = any(kw in body_ct for kw in ('missing', 'ontbreekt', 'fehlt'))
                if has_customs_kw and has_missing_kw:
                    issue_id   = 'customs'
                    state      = 'missing'
                    confidence = max(confidence, 0.80)

            # 16. GAP D: delay low-confidence dampening — prevent informational
            # mentions of "delay" from classifying as Delay / Not On Time
            if issue_id == 'delay' and confidence < 0.65:
                body_dl = ' '.join(filter(None, [description, subject, isr])).lower()
                if not any(s in body_dl for s in _STRONG_TIMING_FAILURE_SIGNALS):
                    confidence = max(confidence - 0.15, 0.30)

            # 17. FIX 1: transport status generic → tracking (no explicit delay signal)
            if issue_id == 'delay':
                body_ts = ' '.join(filter(None, [description, subject, isr])).lower()
                has_status_pat  = any(p in body_ts for p in _TRANSPORT_STATUS_PATTERNS)
                has_expl_delay  = any(s in body_ts for s in _EXPLICIT_DELAY_SIGNALS)
                if has_status_pat and not has_expl_delay:
                    issue_id   = 'tracking'
                    confidence = max(confidence, 0.72)

            return _build(issue_id, state, confidence, rnk=ranked)

    # 18. Fallback regex rules (with intent-family constraint per STEP 5)
    normalized = ' '.join(filter(None, [description, subject, isr, category]))

    # Determine winning intent context from ranked pass so fallback can be constrained
    # Only constrain when there was a strong-signal ranked match (confidence >= threshold)
    _winning_intent_ctx: str | None = None
    if ranked and ranked[0]['confidence'] >= _STRONG_INTENT_THRESHOLD:
        _winning_intent_ctx = _TOPIC_INTENT.get(ranked[0]['issueId'], 'unknown')

    fb = _fallback_classify(normalized)
    if fb:
        # Financial guard — doc/ref fallback inside financial context → rate
        if fb['issueId'] in ('customs', 't1', 'portbase', 'bl', 'load_ref') and _has_strong_financial_context(normalized):
            return _build('rate', 'unknown', 0.70, fb_used=True, rnk=ranked)
        # STEP 5: Constrain fallback to detected intent family
        if _winning_intent_ctx and _winning_intent_ctx != 'unknown':
            fb_intent = _TOPIC_INTENT.get(fb['issueId'], 'unknown')
            if fb_intent != _winning_intent_ctx:
                fb = None  # Reject: fallback conflicts with stronger detected intent

    if fb:
        return _build(fb['issueId'], fb['state'], fb['confidence'], fb_used=True, rnk=ranked)

    # 19. Operational clue scan (also constrained to detected intent family)
    clue = _operational_clue_scan(normalized)
    if clue:
        if _winning_intent_ctx and _winning_intent_ctx != 'unknown':
            clue_intent = _TOPIC_INTENT.get(clue['issueId'], 'unknown')
            if clue_intent != _winning_intent_ctx:
                clue = None
    if clue:
        clue_state = clue['state'] if clue['state'] != 'unknown' else _detect_state_windowed(normalized)
        return _build(clue['issueId'], clue_state, clue['confidence'], fb_used=True, rnk=ranked)

    # 20. Unclassified
    return _build('other', 'unknown', 0.10, fb_used=True, rnk=ranked)


# ─────────────────────────────────────────────────────────────────
# PARSE + NORMALISE
# ─────────────────────────────────────────────────────────────────

def _parse_excel(file_bytes: bytes, filename: str) -> pd.DataFrame:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "xlsx"
    buf = io.BytesIO(file_bytes)

    if ext == "csv":
        df = pd.read_csv(buf, dtype=str, keep_default_na=False)
        return df

    # Read first 30 rows raw to detect header row
    raw = pd.read_excel(buf, header=None, nrows=30, engine="openpyxl")
    best_row = 0
    best_score = 0
    for i, row in raw.iterrows():
        score = sum(1 for v in row if _score_header(str(v)) is not None)
        if score > best_score:
            best_score = score
            best_row = int(str(i))

    buf.seek(0)
    df = pd.read_excel(buf, header=best_row, engine="openpyxl", dtype=str, keep_default_na=False)
    return df


def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Rename columns to standard keys."""
    rename_map: dict[str, str] = {}
    used_keys: set[str] = set()
    for col in df.columns:
        key = _score_header(str(col))
        if key and key not in used_keys:
            rename_map[col] = key
            used_keys.add(key)
    df = df.rename(columns=rename_map)
    return df


# ─────────────────────────────────────────────────────────────────
# FORECAST
# ─────────────────────────────────────────────────────────────────

def _compute_forecast(df: 'pd.DataFrame', issue_breakdown: list[dict]) -> dict:
    """
    Compute a next-week volume forecast using a weighted rolling average of
    the last 3 weeks (50% / 30% / 20% recency weighting).
    Only high-confidence rows (>= 0.60) are used so low-quality classifications
    don't inflate predictions.
    """
    _FORECAST_MIN_CONF = 0.60
    _FORECAST_WEIGHTS  = [0.50, 0.30, 0.20]  # most-recent first

    # Filter to weeks that have at least some classified data
    hq = df[df["confidence"] >= _FORECAST_MIN_CONF].copy()
    weeks = sorted(w for w in hq["weekKey"].unique() if w)

    if len(weeks) < 2:
        return {
            "available": False,
            "reason": "Need at least 2 weeks of high-confidence data for forecasting.",
            "nextWeekVolume": 0,
            "volumeTrend": "stable",
            "confidence": "LOW",
            "weeksAnalyzed": len(weeks),
            "topIssues": [], "risingRisk": [],
            "riskyCustomers": [], "riskyTransporters": [],
            "hotspots": [], "actions": [],
        }

    # Per-week totals and per-issue counts (high-confidence only)
    weekly_totals: dict[str, int] = {}
    weekly_issues: dict[str, dict[str, int]] = {}
    weekly_customers: dict[str, dict[str, int]] = {}
    weekly_transporters: dict[str, dict[str, int]] = {}
    weekly_areas: dict[str, dict[str, int]] = {}

    for wk in weeks:
        wk_df = hq[hq["weekKey"] == wk]
        weekly_totals[wk] = len(wk_df)
        weekly_issues[wk] = wk_df["primaryIssue"].value_counts().to_dict()
        weekly_customers[wk] = wk_df["resolvedCustomer"].dropna().value_counts().to_dict()
        weekly_transporters[wk] = wk_df["resolvedTransporter"].dropna().value_counts().to_dict()
        weekly_areas[wk] = wk_df["resolvedArea"].dropna().value_counts().to_dict()

    use_weeks = weeks[-3:]  # up to 3 most recent
    wts = _FORECAST_WEIGHTS[:len(use_weeks)][::-1]  # oldest→newest order

    # Weighted total volume
    vol_weighted = sum(weekly_totals[w] * wts[i] for i, w in enumerate(use_weeks))
    next_week_vol = max(0, round(vol_weighted))

    # Volume trend
    if len(use_weeks) >= 2:
        prev_vol = weekly_totals[use_weeks[-2]]
        curr_vol = weekly_totals[use_weeks[-1]]
        vol_trend = "up" if curr_vol > prev_vol * 1.10 else ("down" if curr_vol < prev_vol * 0.90 else "stable")
    else:
        vol_trend = "stable"

    # Forecast confidence based on weeks available and data quality
    if len(weeks) >= 4:
        fc_conf = "HIGH"
    elif len(weeks) >= 2:
        fc_conf = "MEDIUM"
    else:
        fc_conf = "LOW"

    # Per-issue forecast
    issue_map = {i["id"]: i for i in issue_breakdown if i["id"] != "other"}
    top_issue_forecast: list[dict] = []
    rising_risk: list[dict] = []

    all_issue_ids = set()
    for wk in use_weeks:
        all_issue_ids |= set(weekly_issues[wk].keys())

    for iid in all_issue_ids:
        if iid == "other" or iid not in issue_map:
            continue
        counts = [weekly_issues[w].get(iid, 0) for w in use_weeks]
        weighted = round(sum(c * wts[i] for i, c in enumerate(counts)))
        cur = counts[-1]
        prev = counts[-2] if len(counts) >= 2 else cur
        trend = "up" if cur > prev * 1.20 else ("down" if cur < prev * 0.80 else "stable")
        meta = issue_map[iid]
        top_issue_forecast.append({
            "id": iid, "label": meta["label"], "color": meta["color"],
            "forecasted": weighted, "trend": trend,
        })
        if trend == "up" and cur >= 3:
            rising_risk.append({
                "id": iid, "label": meta["label"], "color": meta["color"],
                "forecasted": weighted, "trend": trend,
            })

    top_issue_forecast.sort(key=lambda x: x["forecasted"], reverse=True)
    rising_risk.sort(key=lambda x: x["forecasted"], reverse=True)

    # Risky customers (appeared in most recent 2 weeks with increasing trend)
    risky_customers: list[dict] = []
    all_custs = set()
    for wk in use_weeks[-2:]:
        all_custs |= set(weekly_customers.get(wk, {}).keys())
    for cust in all_custs:
        if not cust or cust.lower() in ("", "none", "nan"):
            continue
        recent = weekly_customers.get(use_weeks[-1], {}).get(cust, 0)
        prev_c = weekly_customers.get(use_weeks[-2], {}).get(cust, 0) if len(use_weeks) >= 2 else 0
        trend = "up" if recent > prev_c * 1.20 else ("down" if recent < prev_c * 0.80 else "stable")
        score = recent + (prev_c * 0.5)
        risk = "HIGH" if score >= 10 else ("MEDIUM" if score >= 4 else "LOW")
        if risk != "LOW":
            risky_customers.append({"name": cust, "recentCount": recent, "trend": trend, "risk": risk})
    risky_customers.sort(key=lambda x: x["recentCount"], reverse=True)

    # Risky transporters (high issue rate in recent week)
    risky_transporters: list[dict] = []
    last_wk = use_weeks[-1]
    tp_counts = weekly_transporters.get(last_wk, {})
    for tp, cnt in tp_counts.items():
        if not tp or tp.lower() in ("", "none", "nan") or cnt < 2:
            continue
        total_wk = weekly_totals.get(last_wk, 1)
        rate = round(cnt / total_wk * 100, 1)
        risk = "HIGH" if rate >= 20 else ("MEDIUM" if rate >= 10 else "LOW")
        if risk != "LOW":
            risky_transporters.append({"name": tp, "delayRate": rate, "risk": risk})
    risky_transporters.sort(key=lambda x: x["delayRate"], reverse=True)

    # Area hotspots
    hotspots: list[dict] = []
    all_areas = set()
    for wk in use_weeks:
        all_areas |= set(weekly_areas.get(wk, {}).keys())
    for area in all_areas:
        if not area or area.lower() in ("", "none", "nan"):
            continue
        counts_a = [weekly_areas.get(w, {}).get(area, 0) for w in use_weeks]
        weighted_a = round(sum(c * wts[i] for i, c in enumerate(counts_a)))
        cur_a = counts_a[-1]
        prev_a = counts_a[-2] if len(counts_a) >= 2 else cur_a
        trend_a = "up" if cur_a > prev_a * 1.15 else ("down" if cur_a < prev_a * 0.85 else "stable")
        if weighted_a > 0:
            hotspots.append({"name": area, "forecasted": weighted_a, "trend": trend_a})
    hotspots.sort(key=lambda x: x["forecasted"], reverse=True)

    # Auto-generated actions
    actions: list[str] = []
    if vol_trend == "up":
        actions.append(f"Volume is rising — ensure sufficient capacity for ~{next_week_vol} cases next week.")
    if rising_risk:
        actions.append(f"Escalating categories: {', '.join(r['label'] for r in rising_risk[:3])}. Initiate proactive customer outreach.")
    if risky_customers:
        top_risk = risky_customers[0]['name']
        actions.append(f"Account {top_risk} has the highest recent case volume. Schedule a review call.")
    if risky_transporters:
        top_tp = risky_transporters[0]['name']
        actions.append(f"Transporter {top_tp} has a high issue rate this week — consider SLA review.")
    if not actions:
        actions.append("No significant risks detected. Maintain current operational cadence.")

    return {
        "available": True,
        "nextWeekVolume": next_week_vol,
        "volumeTrend": vol_trend,
        "confidence": fc_conf,
        "weeksAnalyzed": len(weeks),
        "topIssues": top_issue_forecast[:6],
        "risingRisk": rising_risk[:4],
        "riskyCustomers": risky_customers[:5],
        "riskyTransporters": risky_transporters[:5],
        "hotspots": hotspots[:9],
        "actions": actions[:5],
    }


# ─────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────────

def _compute_health_check(df: 'pd.DataFrame', issue_counts: dict, total: int) -> dict:
    """Post-classification health metrics. Fail conditions logged as alerts."""
    if total == 0:
        return {"status": "no_data", "alerts": []}

    other_count = issue_counts.get("other", 0)
    other_pct = round(other_count / total * 100, 1)

    below_60_count = int((df["confidence"] < 0.60).sum())
    below_60_pct = round(below_60_count / total * 100, 1)

    review_true_count = int(df["reviewFlag"].sum()) if "reviewFlag" in df.columns else 0
    review_pct = round(review_true_count / total * 100, 1)

    blank_intent = int((df["detectedIntent"].fillna("").str.strip() == "").sum()) if "detectedIntent" in df.columns else total
    blank_intent_pct = round(blank_intent / total * 100, 1)

    blank_object = int((df["detectedObject"].fillna("").str.strip() == "").sum()) if "detectedObject" in df.columns else total
    blank_object_pct = round(blank_object / total * 100, 1)

    # reviewFlag=False while confidence < 0.60 violations
    if "reviewFlag" in df.columns:
        violations = int(((df["confidence"] < 0.60) & (~df["reviewFlag"].astype(bool))).sum())
    else:
        violations = 0

    categories_seen = len([k for k in issue_counts if k != "other" and issue_counts[k] > 0])

    # Core categories expected in any non-trivial dataset
    _CORE_CATEGORIES = [
        'delay', 'load_ref', 'customs', 'rate', 'amendment',
        'tracking', 'equipment', 'ref_provided', 'communication',
    ]

    alerts = []
    status = "pass"

    # Extraction coverage metrics
    def _col_coverage(col: str) -> float:
        if col not in df.columns:
            return 0.0
        filled = df[col].notna() & (df[col].astype(str).str.strip() != '') & (df[col].astype(str) != 'None')
        return round(float(filled.sum()) / total * 100, 1) if total else 0.0

    transporter_pct  = _col_coverage('resolvedTransporter')
    booking_ref_pct  = _col_coverage('ext_booking_ref')
    load_ref_pct     = _col_coverage('ext_load_ref')
    container_pct    = _col_coverage('ext_container')
    mrn_pct          = _col_coverage('ext_mrn')
    zip_pct          = _col_coverage('zip')
    unknown_state_pct = round(float((df['issueState'] == 'unknown').sum()) / total * 100, 1) if total else 0.0

    if other_pct > 15:
        alerts.append(f"FAIL: Other/Unclassified {other_pct}% > 15% threshold")
        status = "fail"
    if blank_intent_pct > 1:
        alerts.append(f"FAIL: Blank detectedIntent {blank_intent_pct}% > 1% threshold")
        status = "fail"
    if blank_object_pct > 1:
        alerts.append(f"FAIL: Blank detectedObject {blank_object_pct}% > 1% threshold")
        status = "fail"
    if violations > 0:
        alerts.append(f"FAIL: {violations} rows have confidence < 0.60 but reviewFlag=False")
        status = "fail"
    if categories_seen < 6:
        alerts.append(f"WARN: Only {categories_seen} non-Other categories in output — taxonomy underreach")
        if status == "pass":
            status = "warn"
    # Flag missing core categories for datasets >= 100 rows
    if total >= 100:
        missing_core = [c for c in _CORE_CATEGORIES if issue_counts.get(c, 0) == 0]
        if missing_core:
            alerts.append(f"WARN: Core categories with zero rows (dataset={total}): {', '.join(missing_core)}")
            if status == "pass":
                status = "warn"

    return {
        "status": status,
        "totalRows": total,
        "otherCount": other_count,
        "otherPct": other_pct,
        "below60Count": below_60_count,
        "below60Pct": below_60_pct,
        "reviewFlagCount": review_true_count,
        "reviewFlagPct": review_pct,
        "blankIntentCount": blank_intent,
        "blankIntentPct": blank_intent_pct,
        "blankObjectCount": blank_object,
        "blankObjectPct": blank_object_pct,
        "reviewFlagViolations": violations,
        "categoriesSeen": categories_seen,
        "alerts": alerts,
        "transporterCoverage": transporter_pct,
        "bookingRefCoverage":  booking_ref_pct,
        "loadRefCoverage":     load_ref_pct,
        "containerCoverage":   container_pct,
        "mrnCoverage":         mrn_pct,
        "zipCoverage":         zip_pct,
        "unknownStatePct":     unknown_state_pct,
    }


# ─────────────────────────────────────────────────────────────────
# MAIN ENTRY POINT
# ─────────────────────────────────────────────────────────────────

def analyse_file(file_bytes: bytes, filename: str) -> dict:
    df = _parse_excel(file_bytes, filename)

    # Drop fully empty rows
    df = df.dropna(how="all")
    df = df[df.apply(lambda r: r.astype(str).str.strip().str.len().sum() > 0, axis=1)]

    df = _normalise_columns(df)

    # Ensure expected columns exist
    for col in ["subject", "description", "isr_details", "customer", "transporter",
                "zip", "area", "date", "case_number", "booking_ref", "category", "hours"]:
        if col not in df.columns:
            df[col] = ""

    # Coerce types — fill NaN in ALL object columns to empty string
    # (openpyxl may return float NaN for empty cells even with dtype=str)
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].fillna("").astype(str).str.strip()

    # Parse dates
    df["date"] = pd.to_datetime(df["date"], errors="coerce", dayfirst=True)

    # Hours
    df["hours"] = pd.to_numeric(df["hours"], errors="coerce")

    # Classify each row
    classified = df.apply(
        lambda r: pd.Series(_classify_row(
            _clean_text(r.get("subject", "")),
            _clean_text(r.get("description", "")),
            _clean_text(r.get("isr_details", "")),
            _clean_text(r.get("category", "")),
        )),
        axis=1,
    )
    df["primaryIssue"]       = classified["primaryIssue"]
    df["secondaryIssue"]     = classified["secondaryIssue"]
    df["issueState"]         = classified["issueState"]
    df["confidence"]         = classified["confidence"]
    df["reviewFlag"]         = classified["reviewFlag"]
    df["detectedIntent"]     = classified["detectedIntent"]
    df["detectedObject"]     = classified["detectedObject"]
    df["triggerPhrase"]      = classified["triggerPhrase"]
    df["triggerSourceField"] = classified["triggerSourceField"]
    df["evidence"]           = classified["evidence"]
    df["sourceFieldsUsed"]   = classified["sourceFieldsUsed"]
    df["fallbackUsed"]       = classified["fallbackUsed"]
    df["unresolvedReason"]   = classified["unresolvedReason"]

    # Resolve area
    def _row_area(r) -> str | None:
        area_val = _clean_text(r.get("area", ""))
        if area_val:
            return area_val
        zip_val = _clean_text(r.get("zip", ""))
        if zip_val:
            return _resolve_zip_to_area(zip_val)
        combined = " ".join([_clean_text(r.get("subject", "")),
                             _clean_text(r.get("description", ""))])
        zips_found = re.findall(r'\b\d{5}\b', combined)
        for z in zips_found:
            a = _resolve_zip_to_area(z)
            if a:
                return a
        return None

    df["resolvedArea"] = df.apply(_row_area, axis=1)

    # Week key
    df["weekKey"] = df["date"].apply(_week_key)

    # Missing load ref flag
    df["missing_load_ref"] = df["primaryIssue"] == "load_ref"

    # ── RESOLVE ENTITIES ──────────────────────────────────────────

    # Resolve transporter for each row using entity registry
    # Primary: dedicated transporter column → resolve canonical name
    # Fallback: customer column contains a known transporter/depot entity
    def _get_resolved_transporter(r: pd.Series) -> str | None:
        tp = _clean_text(r.get("transporter", ""))
        if tp:
            canon = _canonical_transporter_name(tp)
            if canon:
                return canon
            if _is_operational_transporter(tp):
                return tp
        # Fallback: check customer column
        cust = _clean_text(r.get("customer", ""))
        if cust:
            canon = _canonical_transporter_name(cust)
            if canon:
                return canon
        # Fallback: extract from combined text
        combined = ' '.join(filter(None, [
            _clean_text(str(r.get('subject', '') or '')),
            _clean_text(str(r.get('description', '') or '')),
            _clean_text(str(r.get('isr_details', '') or '')),
        ]))
        return _extract_transporter_from_text(combined)

    df["resolvedTransporter"] = df.apply(_get_resolved_transporter, axis=1)

    # resolvedCustomer: block operational entities from customer chart
    def _get_resolved_customer(r: pd.Series) -> str | None:
        cust = _clean_text(r.get("customer", ""))
        if not cust:
            return None
        if _is_blocked_from_customer(cust):
            return None
        return cust

    df["resolvedCustomer"] = df.apply(_get_resolved_customer, axis=1)

    # ── TEXT EXTRACTION — extract reference values from free text ──
    def _extract_row(r: pd.Series) -> pd.Series:
        combined = ' '.join(filter(None, [
            _clean_text(str(r.get('subject', '') or '')),
            _clean_text(str(r.get('description', '') or '')),
            _clean_text(str(r.get('isr_details', '') or '')),
        ]))
        return pd.Series(_extract_all_refs(combined))

    extracted = df.apply(_extract_row, axis=1)
    for col in ['ext_container', 'ext_booking_ref', 'ext_load_ref', 'ext_mrn', 'ext_t1_ref', 'ext_zip', 'ext_transporter']:
        df[col] = extracted[col]

    # Merge extracted ZIP into zip column (fill blanks)
    df['zip'] = df.apply(
        lambda r: (_clean_text(r.get('zip', '')) or _clean_text(r.get('ext_zip', '') or '')), axis=1
    )
    # Re-resolve area with any newly extracted ZIP
    df['resolvedArea'] = df.apply(_row_area, axis=1)

    # ── PER-ROW OPERATIONAL SIGNALS ───────────────────────────────

    # preventableIssue: True if the row's primaryIssue is in the preventable taxonomy set
    # Explicit bool() ensures the column is always boolean, not numpy bool or int
    _preventable_ids = {t["id"] for t in TAXONOMY if t["preventable"]}
    df["preventableIssue"] = df["primaryIssue"].isin(_preventable_ids).astype(bool)

    # rootCause: keyword-based root cause signal from combined text
    _DELAY_SIGNALS = {
        "weather_delay":        ["weather", "storm", "fog", "ice", "wind", "flood", "snow"],
        "terminal_congestion":  ["congestion", "terminal congestion", "port congestion", "terminal delay",
                                 "berth", "berth delay", "yard full", "port delay"],
        "vessel_delay":         ["vessel delay", "vessel late", "vessel arrival", "eta changed",
                                 "eta update", "ata", "vessel schedule", "sailing delay"],
        "haulier_delay":        ["haulier delay", "driver delay", "truck delay", "haulage delay",
                                 "collection delay", "pickup delay", "driver not available"],
        "missed_cutoff":        ["missed cutoff", "cutoff missed", "missed cut-off", "cut off missed",
                                 "booking cutoff", "vgm cutoff", "si cutoff", "documentation cutoff"],
        "equipment_unavailable":["equipment not available", "container not available", "no equipment",
                                 "equipment shortage", "reefer not available", "flat rack",
                                 "container shortage", "unit not available"],
        "late_booking":         ["late booking", "last minute booking", "booking too late",
                                 "insufficient notice", "short notice"],
        "documentation_error":  ["wrong document", "incorrect document", "document error",
                                 "documentation error", "wrong bl", "bl error", "mismatch"],
        "extra_cost":           ["invoice", "extra cost", "additional cost", "surcharge",
                                 "demurrage", "detention", "overdue", "rechnung", "factuur"],
    }

    def _detect_root_cause(row: pd.Series) -> str:
        primary = str(row.get("primaryIssue", "") or "")
        combined = " ".join(filter(None, [
            str(row.get("subject", "") or ""),
            str(row.get("description", "") or ""),
            str(row.get("isr_details", "") or ""),
        ])).lower()
        if primary == "rate":
            return "extra_cost"
        if primary in ("customs", "t1", "portbase", "bl"):
            for kw in _DELAY_SIGNALS["documentation_error"]:
                if kw in combined:
                    return "documentation_error"
            return "unknown"
        if primary in ("delay", "equipment", "transport_order"):
            for cause, keywords in _DELAY_SIGNALS.items():
                if cause == "extra_cost":
                    continue
                for kw in keywords:
                    if kw in combined:
                        return cause
            return "unknown"
        # For all other categories (amendment, load_ref, vgm, etc.) return unknown
        return "unknown"

    df["rootCause"] = df.apply(_detect_root_cause, axis=1)

    # ── EVIDENCE TOKEN PARITY ──────────────────────────────────────
    # Append structured ref[...] tokens so the frontend toExampleCase()
    # can extract reference values directly from the evidence array,
    # matching the expected format: ref[loadRef]=..., ref[containerNumber]=...,
    # ref[mrnRef]=...
    def _append_ref_tokens(r: pd.Series) -> list:
        evid = list(r.get("evidence") or [])
        if r.get("ext_load_ref"):
            evid.append(f"ref[loadRef]={r['ext_load_ref']}")
        if r.get("ext_container"):
            evid.append(f"ref[containerNumber]={r['ext_container']}")
        if r.get("ext_mrn"):
            evid.append(f"ref[mrnRef]={r['ext_mrn']}")
        return evid

    df["evidence"] = df.apply(_append_ref_tokens, axis=1)

    # ── AGGREGATIONS ──────────────────────────────────────────────

    total = len(df)

    # Issue counts
    issue_counts = df["primaryIssue"].value_counts().to_dict()

    # Preventable
    preventable_ids = {t["id"] for t in TAXONOMY if t["preventable"]}
    preventable_df = df[df["primaryIssue"].isin(preventable_ids)]
    preventable_count = len(preventable_df)
    preventable_rate = round(preventable_count / total * 100, 1) if total else 0

    # Hours lost
    explicit_hours = df["hours"].dropna().sum()
    estimated_hours = len(preventable_df) * 2.0
    hours_lost = float(explicit_hours) if explicit_hours > 0 else estimated_hours

    # By customer — exclude operational entities
    cust_df = df[df["resolvedCustomer"].notna() & (df["resolvedCustomer"] != "")]
    by_customer = (
        cust_df.groupby("resolvedCustomer")
        .size()
        .sort_values(ascending=False)
        .to_dict()
    )

    # By transporter — only entities with transporter role
    trans_df = df[df["resolvedTransporter"].notna() & (df["resolvedTransporter"] != "")]
    by_transporter: dict[str, Any] = {}
    for tp, grp in trans_df.groupby("resolvedTransporter"):
        cnt = len(grp)
        delay_cnt = int(grp["primaryIssue"].isin({"delay", "waiting_time"}).sum())
        punctuality_score = round((cnt - delay_cnt) / cnt * 100, 1) if cnt else 100.0
        by_transporter[str(tp)] = {"count": cnt, "punctuality_score": punctuality_score}

    # By area
    area_df = df[df["resolvedArea"].notna() & (df["resolvedArea"] != "")]
    ALLOWED_AREAS = {"Mainz / Germersheim", "Duisburg / Rhine-Ruhr"}
    area_counts: dict[str, int] = {}
    for _, row in area_df.iterrows():
        a = row["resolvedArea"]
        if a in ALLOWED_AREAS:
            area_counts[a] = area_counts.get(a, 0) + 1

    # Missing load ref by customer
    mlr_df = df[df["missing_load_ref"] & df["resolvedCustomer"].notna() & (df["resolvedCustomer"] != "")]
    missing_load_ref_by_customer = (
        mlr_df.groupby("resolvedCustomer")
        .size()
        .sort_values(ascending=False)
        .to_dict()
    )

    # Week-on-week delta
    wow_delta: dict[str, Any] = {}
    weeks = sorted(w for w in df["weekKey"].unique() if w)
    if len(weeks) >= 2:
        cur_wk = weeks[-1]
        prev_wk = weeks[-2]
        cur = df[df["weekKey"] == cur_wk]["primaryIssue"].value_counts().to_dict()
        prev = df[df["weekKey"] == prev_wk]["primaryIssue"].value_counts().to_dict()
        all_ids = set(cur) | set(prev)
        for issue_id in all_ids:
            c, p = cur.get(issue_id, 0), prev.get(issue_id, 0)
            pct = round((c - p) / p * 100, 1) if p else None
            wow_delta[issue_id] = {"current": c, "prior": p, "pct_change": pct}

    # Issue breakdown — all categories (no top-10 cap; dashboard filters as needed)
    top_issues = sorted(issue_counts.items(), key=lambda x: x[1], reverse=True)
    issue_breakdown = []
    for iid, cnt in top_issues:
        tax = TAXONOMY_MAP.get(iid, TAXONOMY_MAP["other"])
        issue_breakdown.append({
            "id": iid,
            "label": tax["label"],
            "count": cnt,
            "percent": round(cnt / total * 100, 1) if total else 0,
            "hoursLost": round(cnt * tax["hours"], 1),
            "preventable": tax["preventable"],
            "color": tax["color"],
        })

    # Cases list (all rows serialised)
    def _serialize_row(r: pd.Series) -> dict:
        out: dict[str, Any] = {}
        for k, v in r.items():
            # Catch NaT, NaN, and any other pandas NA types first
            try:
                if pd.isna(v):
                    out[str(k)] = None
                    continue
            except (TypeError, ValueError):
                pass
            if isinstance(v, pd.Timestamp):
                out[str(k)] = v.isoformat()
            elif isinstance(v, float) and math.isnan(v):
                out[str(k)] = None
            else:
                out[str(k)] = v
        return out

    # Return only key fields per case to keep response small
    import json as _json
    KEY_FIELDS = [
        "case_number", "subject", "description", "isr_details", "customer", "transporter",
        "date", "status", "priority", "zip", "area", "booking_ref", "category",
        "primaryIssue", "secondaryIssue", "issueState",
        "confidence", "reviewFlag",
        "detectedIntent", "detectedObject",
        "triggerPhrase", "triggerSourceField",
        "fallbackUsed", "unresolvedReason",
        "resolvedArea", "resolvedCustomer", "resolvedTransporter",
        "weekKey", "missing_load_ref",
        # Operational signals
        "rootCause", "preventableIssue",
        # Evidence trail (serialized as JSON strings by the loop below)
        "evidence", "sourceFieldsUsed",
        # Extracted reference fields
        "ext_container", "ext_booking_ref", "ext_load_ref",
        "ext_mrn", "ext_t1_ref", "ext_zip", "ext_transporter",
    ]
    keep_cols = [c for c in KEY_FIELDS if c in df.columns]
    cases_df = df[keep_cols].copy()

    # Serialize list/array columns to JSON strings for transport
    for list_col in ["evidence", "sourceFieldsUsed"]:
        if list_col in df.columns:
            import json as _json_inner
            cases_df[list_col] = df[list_col].apply(
                lambda v: _json_inner.dumps(v) if isinstance(v, list) else (v or "[]")
            )

    cases = _json.loads(cases_df.to_json(orient='records', date_format='iso', default_handler=str))

    # Summary
    top_issue_id = top_issues[0][0] if top_issues else "other"
    top_issue_label = TAXONOMY_MAP.get(top_issue_id, TAXONOMY_MAP["other"])["label"]
    top_customer = max(by_customer, key=lambda k: by_customer[k]) if by_customer else ""
    top_transporter = max(by_transporter, key=lambda k: by_transporter[k]["count"]) if by_transporter else ""
    top_area = max(area_counts, key=lambda k: area_counts[k]) if area_counts else ""

    week_range = f"{weeks[0]} – {weeks[-1]}" if len(weeks) >= 2 else (weeks[0] if weeks else "")

    return {
        "meta": {
            "filename": filename,
            "rowCount": total,
            "analyzedAt": datetime.now(timezone.utc).isoformat(),
        },
        "summary": {
            "totalCases": total,
            "totalHoursLost": round(hours_lost, 1),
            "preventablePct": preventable_rate,
            "preventableCount": preventable_count,
            "topIssue": top_issue_label,
            "topIssueCount": top_issues[0][1] if top_issues else 0,
            "topIssuePercent": issue_breakdown[0]["percent"] if issue_breakdown else 0,
            "topCustomer": top_customer,
            "topCustomerCount": by_customer.get(top_customer, 0),
            "topTransporter": top_transporter,
            "topArea": top_area,
            "topAreaCount": area_counts.get(top_area, 0),
            "weekRange": week_range,
            "weekCount": len(weeks),
        },
        "issueBreakdown": issue_breakdown,
        "issue_counts": issue_counts,
        "by_customer": by_customer,
        "by_transporter": by_transporter,
        "by_area": area_counts,
        "missing_load_ref_by_customer": missing_load_ref_by_customer,
        "wow_delta": wow_delta,
        "hours_lost_estimate": round(hours_lost, 1),
        "total_cases": total,
        "preventable_count": preventable_count,
        "preventable_rate": preventable_rate,
        "cases": cases,
        "health_check": _compute_health_check(df, issue_counts, total),
        "forecast": _compute_forecast(df, issue_breakdown),
    }
