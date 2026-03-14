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


LOAD_REF_MISSING_PHRASES = [
    "please provide load ref", "please send load ref", "load ref missing",
    "load ref not received", "no load ref", "missing load ref", "load ref required",
    "load ref needed", "please provide reference", "reference missing",
    "no reference provided", "reference not provided", "reference not received",
    "please provide booking", "booking missing", "no booking ref",
    "booking number missing", "booking not received", "please send reference",
    "ref not provided", "ref missing", "no ref", "without reference",
    "without load ref", "without booking", "ref not available",
]

PROVIDED_REF_PHRASES = [
    "load ref is", "load ref:", "load ref -", "load ref–",
    "booking ref is", "booking ref:", "bkg:", "bkg is",
    "reference is", "ref is", "ref:", "ref no:", "ref no is",
    "please find", "please see", "please find below", "hereby",
    "find attached", "attached is", "as requested", "as discussed",
    "please note", "for your information", "fyi",
    "please be informed", "please be advised",
]

PLANNING_BLOCKLIST = [
    "demurrage", "detention", "storage", "rate", "invoice", "billing",
    "price", "pricing", "surcharge", "payment", "credit note",
    "feasibility", "capacity", "availability", "slot request",
    "is it possible", "can you", "can we",
]

DELAY_KEYWORDS = {"delay", "delayed", "not on time", "late", "overdue", "behind schedule",
                  "eta missed", "running late", "late delivery", "late arrival"}


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


def _detect_issue(text_lower: str) -> str:
    """Return taxonomy id for the best-matching issue, or 'other'."""
    best_id = "other"
    best_score = 0
    for item in TAXONOMY:
        if item["id"] == "other":
            continue
        score = 0
        for kw in item["keywords"]:
            if kw in text_lower:
                score += len(kw)
        if score > best_score:
            best_score = score
            best_id = item["id"]
    return best_id


def _detect_issue_weighted(description: str, subject: str, isr: str, category: str) -> str:
    """Score each field with different weights; return best taxonomy match or 'other'."""
    fields = [
        (description.lower(), 3.0),
        (subject.lower(), 2.0),
        (isr.lower(), 1.5),
        (category.lower(), 1.0),
    ]
    scores: dict[str, float] = {}
    for item in TAXONOMY:
        if item["id"] == "other":
            continue
        score = 0.0
        for text, weight in fields:
            for kw in item["keywords"]:
                if kw in text:
                    score += len(kw) * weight
        if score > 0:
            scores[item["id"]] = score
    if not scores:
        return "other"
    return max(scores, key=lambda k: scores[k])


def _recover_issue(combined: str) -> str:
    """Broad recovery pass using RECOVERY_SIGNALS before assigning 'other'."""
    for signals, issue_id in RECOVERY_SIGNALS:
        for sig in signals:
            if sig in combined:
                return issue_id
    return "other"


def _detect_state(combined: str) -> str:
    """Detect the issue state from combined text."""
    if any(p in combined for p in ["missing", "not received", "not provided", "required",
                                    "needed", "please provide", "please send"]):
        return "missing"
    if any(p in combined for p in ["provided", "attached", "please find", "hereby",
                                    "as requested", "please see below", "find below"]):
        return "provided"
    if any(p in combined for p in ["amended", "corrected", "updated", "changed"]):
        return "amended"
    if any(p in combined for p in ["delay", "delayed", "overdue", "late", "not on time"]):
        return "delayed"
    if any(p in combined for p in ["escalat", "complaint", "unacceptable"]):
        return "escalated"
    if any(p in combined for p in ["for your information", "fyi", "please be informed",
                                    "just to confirm"]):
        return "informational"
    return "unknown"


def _classify_load_ref(combined: str) -> bool:
    """Return True only if the case passes the strict missing-load-ref gate."""
    low = combined.lower()
    # Explicit missing phrase → accept
    for phrase in LOAD_REF_MISSING_PHRASES:
        if phrase in low:
            return True
    # Planning blocklist → reject
    for block in PLANNING_BLOCKLIST:
        if block in low:
            return False
    # Loose proximity: "load ref" near request signal
    if "load ref" in low or "loadref" in low:
        request_signals = ["please", "missing", "no ", "not received", "required", "needed", "without"]
        for sig in request_signals:
            if sig in low:
                return True
    return False


def _provided_ref(combined: str) -> bool:
    low = combined.lower()
    for phrase in PROVIDED_REF_PHRASES:
        if phrase in low:
            return True
    return False


def _classify_row(subject: str, description: str, isr: str, category: str) -> dict:
    """Classify a single row. Returns primaryIssue, issueState, confidence."""

    # 1. Direct category field mapping — highest confidence, bypasses scoring
    if category:
        cat_key = category.lower().strip()
        if cat_key in CATEGORY_MAP:
            mapped = CATEGORY_MAP[cat_key]
            combined = " ".join(filter(None, [description, subject, isr])).lower()
            state = _detect_state(combined)
            return {"primaryIssue": mapped, "issueState": state, "confidence": 0.88}

    combined = " ".join(filter(None, [description, subject, isr, category])).lower()

    # 2. Transport order wins over load_ref
    for kw in ["transport order", "transport instruction", "haulier order", "tro "]:
        if kw in combined:
            state = _detect_state(combined)
            return {"primaryIssue": "transport_order", "issueState": state, "confidence": 0.82}

    # 3. Strict load-ref gate
    if _classify_load_ref(combined):
        state = "provided" if _provided_ref(combined) else "missing"
        return {"primaryIssue": "load_ref", "issueState": state, "confidence": 0.80}

    # 4. Weighted multi-field scoring (description 3×, subject 2×, isr 1.5×, category 1×)
    issue_id = _detect_issue_weighted(description, subject, isr, category)

    # 5. Recovery pass — broad signals before giving up on "other"
    if issue_id == "other":
        issue_id = _recover_issue(combined)

    state = _detect_state(combined)
    confidence = 0.65 if issue_id != "other" else 0.30

    return {"primaryIssue": issue_id, "issueState": state, "confidence": confidence}


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
