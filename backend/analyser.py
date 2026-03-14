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
            'purchase order', 'po number', 'po no',
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
     'pattern': re.compile(r'\b(?:load\s*ref(?:erence)?|booking\s*ref(?:erence)?|ref(?:erence)?)\s*(?:is|:|no\.?|#)\s*[A-Z0-9]{4,}', re.I),
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
            return {'issueId': issue_id, 'state': state, 'confidence': 0.35}
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


def _classify_row(subject: str, description: str, isr: str, category: str) -> dict:
    """
    Classify a single row. Mirrors the full classifyCase.ts pipeline:
    1. Direct category column mapping
    2. Financial subject early-exit
    3. Per-field weighted classification (description 1.0, subject 0.88, isr 0.78, category 0.70)
    4. Description-first override (body overrides subject when topics conflict)
    5. load_ref → ref_provided when body contains an explicit ref value
    6. Fallback regex rules
    7. Operational clue scan
    8. Other
    """
    fields: dict[str, str] = {
        'description': description or '',
        'subject':     subject or '',
        'isr':         isr or '',
        'category':    category or '',
    }

    # 1. Direct category column mapping (highest confidence, bypasses scoring)
    if category:
        cat_key = category.lower().strip()
        if cat_key in CATEGORY_MAP:
            mapped = CATEGORY_MAP[cat_key]
            combined = ' '.join(filter(None, [description, subject, isr]))
            state = _detect_state_windowed(combined)
            return {'primaryIssue': mapped, 'issueState': state, 'confidence': 0.88}

    # 2. Financial subject early-exit — unambiguous financial subjects override everything
    subj_lower = subject.lower()
    for pat in _FINANCIAL_SUBJECT_PATTERNS:
        if pat in subj_lower:
            return {'primaryIssue': 'rate', 'issueState': 'unknown', 'confidence': 0.92}

    # 3. Per-field weighted classification
    # Classify each field independently; accumulate highest weighted confidence per issue.
    match_map: dict[str, dict] = {}

    for field_key, weight in _FIELD_WEIGHTS:
        field_text = fields[field_key]
        if not field_text.strip():
            continue
        field_matches = _classify_by_rules(field_text)
        for m in field_matches:
            # load_ref from subject is severely down-weighted (billing emails often mention
            # "load ref" incidentally in the subject line without it being the core issue)
            eff_weight = _LOAD_REF_SUBJECT_WEIGHT if (field_key == 'subject' and m['issueId'] == 'load_ref') else weight
            weighted_conf = min(m['confidence'] * eff_weight, 0.98)
            existing = match_map.get(m['issueId'])
            if not existing or weighted_conf > existing['confidence']:
                match_map[m['issueId']] = {**m, 'confidence': weighted_conf, '_field': field_key}

    # Fall back to combined text if no per-field matches (e.g. very short rows)
    if not match_map:
        normalized = ' '.join(filter(None, [description, subject, isr, category]))
        for m in _classify_by_rules(normalized):
            match_map[m['issueId']] = m

    ranked = sorted(match_map.values(), key=lambda m: m['confidence'], reverse=True)

    if ranked:
        best = ranked[0]
        issue_id   = best['issueId']
        state      = best['state']
        confidence = best['confidence']

        # 4. Description-first override
        # If description classifies as a DIFFERENT topic at ≥ 0.55 confidence,
        # description wins (body is source of truth over subject shorthand).
        if len(description.strip()) > 30:
            desc_matches = _classify_by_rules(description)
            if desc_matches:
                desc_primary = desc_matches[0]
                topics_differ = (
                    desc_primary['issueId'] != issue_id and
                    not (desc_primary['issueId'] == 'ref_provided' and issue_id == 'load_ref') and
                    not (desc_primary['issueId'] == 'load_ref'    and issue_id == 'ref_provided')
                )
                if topics_differ and desc_primary['confidence'] >= 0.55:
                    issue_id   = desc_primary['issueId']
                    state      = desc_primary['state']
                    confidence = min(desc_primary['confidence'], confidence + 0.05)

        # 5. load_ref → ref_provided when body provides an explicit reference value
        if issue_id == 'load_ref':
            body = ' '.join(filter(None, [description, subject, isr]))
            ref_in_body = bool(re.search(
                r'\b(?:load\s*ref(?:erence)?|loadref|booking\s*ref(?:erence)?|ref(?:erence)?)\s*'
                r'(?:is|:|no\.?|#)?\s*[A-Z0-9]*[0-9][A-Z0-9]{3,}',
                body, re.I
            ))
            if ref_in_body:
                issue_id = 'ref_provided'
                state    = 'provided'

        # ref_provided and load_ref cannot coexist — ref_provided wins
        if 'ref_provided' in match_map and issue_id == 'load_ref':
            issue_id = 'ref_provided'
            state    = 'provided'

        return {'primaryIssue': issue_id, 'issueState': state, 'confidence': confidence}

    # 6. Fallback regex rules
    normalized = ' '.join(filter(None, [description, subject, isr, category]))
    fb = _fallback_classify(normalized)
    if fb:
        return {'primaryIssue': fb['issueId'], 'issueState': fb['state'], 'confidence': fb['confidence']}

    # 7. Operational clue scan
    clue = _operational_clue_scan(normalized)
    if clue:
        return {'primaryIssue': clue['issueId'], 'issueState': clue['state'], 'confidence': clue['confidence']}

    # 8. Unclassified
    return {'primaryIssue': 'other', 'issueState': 'unknown', 'confidence': 0.10}


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

    # Coerce types
    for col in ["subject", "description", "isr_details", "customer", "transporter",
                "zip", "area", "case_number", "booking_ref", "category", "status", "priority"]:
        if col in df.columns:
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
    df["primaryIssue"] = classified["primaryIssue"]
    df["issueState"] = classified["issueState"]
    df["confidence"] = classified["confidence"]

    # Resolve area
    def _row_area(r) -> str | None:
        if r.get("area", "").strip():
            return r["area"].strip()
        if r.get("zip", "").strip():
            return _resolve_zip_to_area(r["zip"])
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
            return canon if canon else (tp if _is_operational_transporter(tp) else None)
        # Fallback: check customer column
        cust = _clean_text(r.get("customer", ""))
        if cust:
            canon = _canonical_transporter_name(cust)
            return canon
        return None

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

    # Issue breakdown (top 10)
    top_issues = sorted(issue_counts.items(), key=lambda x: x[1], reverse=True)[:10]
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
    KEY_FIELDS = ["case_number", "subject", "customer", "transporter", "date",
                  "zip", "area", "booking_ref", "category", "primaryIssue",
                  "issueState", "confidence", "resolvedArea", "weekKey", "missing_load_ref"]
    keep_cols = [c for c in KEY_FIELDS if c in df.columns]
    cases_df = df[keep_cols].copy()
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
    }
