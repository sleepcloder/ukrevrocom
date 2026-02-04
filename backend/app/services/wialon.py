import httpx
import json
from typing import Optional, Dict, Any, List
from datetime import datetime


class WialonService:
    """Service for interacting with Wialon API."""

    BASE_URL = "https://hst-api.wialon.com/wialon/ajax.html"

    # Wialon flags for data retrieval
    # https://sdk.wialon.com/wiki/en/sidebar/remoteapi/apiref/format/unit
    FLAG_BASE = 0x00000001          # 1 - base info (id, name)
    FLAG_CUSTOM_PROPS = 0x00000002  # 2 - custom properties
    FLAG_BILLING = 0x00000004       # 4 - billing info
    FLAG_CUSTOM_FIELDS = 0x00000008 # 8 - custom fields
    FLAG_IMAGE = 0x00000010         # 16 - image
    FLAG_MESSAGES = 0x00000020      # 32 - messages params
    FLAG_GUID = 0x00000040          # 64 - GUID
    FLAG_ADMIN_FIELDS = 0x00000080  # 128 - admin fields
    FLAG_ACTIVATION = 0x00000100    # 256 - activation status (act field)
    FLAG_LAST_MSG = 0x00000400      # 1024 - last message and position
    FLAG_SENSORS = 0x00001000       # 4096 - sensors
    FLAG_COUNTERS = 0x00002000      # 8192 - counters (mileage, engine hours)
    FLAG_MAINTENANCE = 0x00008000   # 32768 - maintenance
    FLAG_COMMANDS = 0x00080000      # 524288 - commands
    FLAG_MSG_PARAMS = 0x00100000    # 1048576 - message params
    FLAG_CONNECTION = 0x00200000    # 2097152 - connection state
    FLAG_POSITION = 0x00400000      # 4194304 - position
    FLAG_LAST_MSG_POS = 0x00000400  # 1024 - last message with position

    def __init__(self, token: str):
        self.token = token
        self.sid: Optional[str] = None

    async def _request(self, svc: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Make a request to Wialon API."""
        async with httpx.AsyncClient() as client:
            url = f"{self.BASE_URL}?svc={svc}&params={json.dumps(params)}"
            if self.sid:
                url += f"&sid={self.sid}"

            response = await client.get(url, timeout=30.0)
            return response.json()

    async def login(self) -> bool:
        """Login to Wialon API and get session ID."""
        result = await self._request("token/login", {"token": self.token})

        if "eid" in result:
            self.sid = result["eid"]
            return True
        return False

    async def ensure_session(self) -> bool:
        """Ensure we have a valid session."""
        if not self.sid:
            return await self.login()
        return True

    async def search_units(
        self,
        flags: int = 1025,
        from_idx: int = 0,
        to_idx: int = 0
    ) -> Dict[str, Any]:
        """Search for all units (vehicles)."""
        if not await self.ensure_session():
            return {"error": "Failed to login"}

        params = {
            "spec": {
                "itemsType": "avl_unit",
                "propName": "sys_name",
                "propValueMask": "*",
                "sortType": "sys_name"
            },
            "force": 1,
            "flags": flags,
            "from": from_idx,
            "to": to_idx
        }

        result = await self._request("core/search_items", params)

        if result.get("error") == 1:
            self.sid = None
            if await self.login():
                result = await self._request("core/search_items", params)

        return result

    async def get_unit_by_id(self, unit_id: int) -> Optional[Dict[str, Any]]:
        """Get detailed info about a specific unit."""
        if not await self.ensure_session():
            return None

        # Get all available data for the unit
        flags = (
            self.FLAG_BASE |
            self.FLAG_CUSTOM_PROPS |
            self.FLAG_CUSTOM_FIELDS |
            self.FLAG_IMAGE |
            self.FLAG_LAST_MSG |
            self.FLAG_SENSORS |
            self.FLAG_COUNTERS |
            self.FLAG_CONNECTION |
            self.FLAG_POSITION
        )

        params = {
            "id": unit_id,
            "flags": flags
        }

        result = await self._request("core/search_item", params)

        if result.get("error") == 1:
            self.sid = None
            if await self.login():
                result = await self._request("core/search_item", params)

        if "item" in result:
            return self._format_unit_detail(result["item"])
        return None

    def _format_unit_detail(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Format detailed unit data."""
        pos = item.get("pos") or {}
        last_time = pos.get("t", 0)
        is_online = (datetime.utcnow().timestamp() - last_time) < 600 if last_time else False

        # Get counters (mileage, engine hours) - cfl can be dict or int
        counters = item.get("cfl", {})
        if isinstance(counters, dict):
            mileage = counters.get("cnm", 0)
            engine_hours = counters.get("cneh", 0)
        else:
            mileage = 0
            engine_hours = 0

        # Get last message parameters (sensor readings)
        lmsg = item.get("lmsg") or {}
        lmsg_params = lmsg.get("p") or {}

        # Extract sensor values from last message
        sensor_data = {
            "fuel_level": lmsg_params.get("fuel_level", lmsg_params.get("fuel1", lmsg_params.get("adc1", 0))),
            "fuel_level_2": lmsg_params.get("fuel_level_2", lmsg_params.get("fuel2", lmsg_params.get("adc2", 0))),
            "fuel_consumption": lmsg_params.get("fuel_consumption", 0),
            "engine_rpm": lmsg_params.get("engine_rpm", lmsg_params.get("rpm", 0)),
            "coolant_temp": lmsg_params.get("coolant_temp", lmsg_params.get("engine_temp", 0)),
            "engine_hours_lmsg": lmsg_params.get("engine_hours", 0),
            "ignition": lmsg_params.get("ignition", lmsg_params.get("in1", 0)),
            "pwr_ext": lmsg_params.get("pwr_ext", lmsg_params.get("pwr", 0)),
            "pwr_int": lmsg_params.get("pwr_int", 0),
            "gsm_signal": lmsg_params.get("gsm", lmsg_params.get("gsm_signal", 0)),
            "adc1": lmsg_params.get("adc1", 0),
            "adc2": lmsg_params.get("adc2", 0),
            "adc3": lmsg_params.get("adc3", 0),
            "adc4": lmsg_params.get("adc4", 0),
            "hdop": lmsg_params.get("hdop", pos.get("hd", 0)),
            "mileage_lmsg": lmsg_params.get("mileage", 0),
        }

        # Get custom fields
        custom_fields = {}
        for field in item.get("flds", {}).values():
            if isinstance(field, dict):
                custom_fields[field.get("n", "")] = field.get("v", "")

        # Get custom properties
        custom_props = item.get("prp", {})

        # Get sensors configuration
        sensors_config = {}
        for sensor_id, sensor in item.get("sens", {}).items():
            if isinstance(sensor, dict):
                sensors_config[sensor.get("n", f"sensor_{sensor_id}")] = {
                    "type": sensor.get("t", ""),
                    "param": sensor.get("p", ""),
                    "description": sensor.get("d", ""),
                }

        # Get device info
        device_type = item.get("hw", "")
        phone = item.get("ph", "")
        phone2 = item.get("ph2", "")
        uid = item.get("uid", "")
        uid2 = item.get("uid2", "")

        return {
            "id": item.get("id"),
            "name": item.get("nm", "Unknown"),
            "latitude": pos.get("y"),
            "longitude": pos.get("x"),
            "speed": pos.get("s", 0),
            "course": pos.get("c", 0),
            "altitude": pos.get("z", 0),
            "satellites": pos.get("sc", 0),
            "last_time": datetime.fromtimestamp(last_time).isoformat() if last_time else None,
            "is_online": is_online,
            "mileage": mileage if mileage else sensor_data.get("mileage_lmsg", 0),
            "engine_hours": engine_hours if engine_hours else sensor_data.get("engine_hours_lmsg", 0),
            "device_type": device_type,
            "phone": phone,
            "phone2": phone2,
            "uid": uid,
            "uid2": uid2,
            "custom_fields": custom_fields,
            "sensors": sensors_config,
            "sensor_data": sensor_data,
            "icon": item.get("uri", ""),
        }

    async def _get_tracker_types_map(self) -> Dict[int, str]:
        """Get mapping of unit_id to tracker type name."""
        tracker_map = {}
        tracker_names = ['Avtograph', 'Teltonika*', 'BCE*', 'Xirgo*', 'Wialon*', 'Queclink*', 'Galileo*', 'Bitrek*']

        for tracker_pattern in tracker_names:
            params = {
                'spec': {
                    'itemsType': 'avl_unit',
                    'propName': 'rel_hw_type_name',
                    'propValueMask': tracker_pattern,
                    'sortType': 'sys_name'
                },
                'force': 1,
                'flags': 1,  # Only need id
                'from': 0,
                'to': 0  # Get all
            }
            result = await self._request('core/search_items', params)
            # Clean tracker name (remove wildcard)
            tracker_name = tracker_pattern.replace('*', '')
            for item in result.get('items', []):
                tracker_map[item.get('id')] = tracker_name

        return tracker_map

    async def get_units_list(self) -> List[Dict[str, Any]]:
        """Get a formatted list of units with their data."""
        # First, get tracker types mapping
        tracker_map = await self._get_tracker_types_map()

        # Full flags including message parameters and activation status
        flags = (
            self.FLAG_BASE |           # 1 - name, id
            self.FLAG_CUSTOM_FIELDS |  # 8 - custom fields
            self.FLAG_ACTIVATION |     # 256 - activation status (act field)
            self.FLAG_LAST_MSG |       # 1024 - last message and position
            self.FLAG_COUNTERS |       # 8192 - mileage, engine hours
            self.FLAG_MSG_PARAMS       # 1048576 - message params (sensor data)
        )

        result = await self.search_units(flags=flags)

        if "error" in result:
            return []

        units = []
        for item in result.get("items", []):
            pos = item.get("pos") or {}
            last_time = pos.get("t", 0)
            is_online = (datetime.utcnow().timestamp() - last_time) < 600 if last_time else False

            # Get counters (cfl can be dict or int)
            counters = item.get("cfl", {})
            if isinstance(counters, dict):
                mileage = counters.get("cnm", 0)
                engine_hours = counters.get("cneh", 0)
            else:
                mileage = 0
                engine_hours = 0

            # Get custom fields
            custom_fields = {}
            flds = item.get("flds", {})
            if isinstance(flds, dict):
                for field in flds.values():
                    if isinstance(field, dict):
                        custom_fields[field.get("n", "")] = field.get("v", "")

            # Determine unit type from name
            name_lower = item.get("nm", "").lower()
            unit_type = custom_fields.get("Тип", "")

            if not unit_type:
                # Tractors
                if any(x in name_lower for x in ["case", "john deere", "claas", "new holland", "fendt",
                    "massey", "agrotron", "deutz", "magnum", "puma", "farmall", "maxxum", "axion",
                    "xerion", "arion", "quadtrac", "steiger", "challenger", "versatile", "valtra"]):
                    unit_type = "Трактор"
                # Loaders
                elif any(x in name_lower for x in ["bobcat", "jcb", "loader", "навантажувач", "погрузчик",
                    "manitou", "merlo", "telehandler"]):
                    unit_type = "Навантажувач"
                # Harvesters / Combines
                elif any(x in name_lower for x in ["combine", "комбайн", "harvester", "lexion", "tucano"]):
                    unit_type = "Комбайн"
                # Sprayers
                elif any(x in name_lower for x in ["sprayer", "обприскувач", "patriot", "berthoud", "raptor"]):
                    unit_type = "Обприскувач"
                else:
                    unit_type = "Інше"

            # Get tracker type from pre-built map (default to "Avtograph" if not found)
            unit_id = item.get("id")
            tracker_type = tracker_map.get(unit_id, "Avtograph")

            # Get navigation system from prms
            prms = item.get("prms", {})
            navigation_system = prms.get("navigation_system", {}).get("v", "")

            # Activation status (act: 0 = inactive, 1 = active)
            is_activated = item.get("act", 0) == 1

            unit = {
                "id": item.get("id"),
                "name": item.get("nm", "Unknown"),
                "latitude": pos.get("y"),
                "longitude": pos.get("x"),
                "speed": pos.get("s", 0),
                "course": pos.get("c", 0),
                "altitude": pos.get("z", 0),
                "satellites": pos.get("sc", 0),
                "last_time": datetime.fromtimestamp(last_time).isoformat() if last_time else None,
                "is_online": is_online,
                "mileage": mileage,
                "engine_hours": engine_hours,
                "custom_fields": custom_fields,
                "unit_type": unit_type,
                "tracker_type": tracker_type,
                "navigation_system": navigation_system,
                "inputs_expander_status": 0,
                "is_activated": is_activated,
            }
            units.append(unit)

        return units


wialon_service: Optional[WialonService] = None


def get_wialon_service(token: str) -> WialonService:
    """Get or create Wialon service instance."""
    global wialon_service
    if wialon_service is None or wialon_service.token != token:
        wialon_service = WialonService(token)
    return wialon_service
