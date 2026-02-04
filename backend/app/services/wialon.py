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

        # Get all available data for the unit (maximum flags)
        flags = 4194303  # 0x3FFFFF - all flags for maximum data

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

    async def get_unit_raw_data(self, unit_id: int) -> Optional[Dict[str, Any]]:
        """Get raw API response for a unit with all available flags."""
        if not await self.ensure_session():
            return None

        # Maximum flags to get ALL available data
        flags = 4194303  # 0x3FFFFF - all flags

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
            return result["item"]
        return None

    async def get_ignition_sensors(self) -> List[Dict[str, Any]]:
        """Get all ignition/engine sensors from all units using optimized bulk request."""
        if not await self.ensure_session():
            return []

        # Use FLAG_BASE (1) + FLAG_SENSORS (4096) = 4097 to get only names and sensors
        flags = self.FLAG_BASE | self.FLAG_SENSORS  # 4097

        params = {
            "spec": {
                "itemsType": "avl_unit",
                "propName": "sys_name",
                "propValueMask": "*",
                "sortType": "sys_name"
            },
            "force": 1,
            "flags": flags,
            "from": 0,
            "to": 0  # 0 means all items
        }

        result = await self._request("core/search_items", params)

        if result.get("error") == 1:
            self.sid = None
            if await self.login():
                result = await self._request("core/search_items", params)

        items = result.get("items", [])
        ignition_sensors = []

        for item in items:
            unit_id = item.get("id")
            unit_name = item.get("nm", "")
            sens = item.get("sens", {})

            if not sens:
                continue

            for sens_id, sens_data in sens.items():
                sensor_type = sens_data.get('t', '').lower()

                # Filter for engine-related sensors
                if any(keyword in sensor_type for keyword in ['engine', 'ignition']):
                    # Parse config JSON
                    config = sens_data.get('c', '{}')
                    if isinstance(config, str):
                        try:
                            import json
                            config = json.loads(config)
                        except:
                            config = {}

                    # Get validator sensor name by looking up in the same unit's sensors
                    validator_sensor_name = ""
                    validator_sensor_id = sens_data.get('vs', 0)
                    if validator_sensor_id and validator_sensor_id > 0:
                        vs_key = str(validator_sensor_id)
                        if vs_key in sens:
                            validator_sensor_name = sens[vs_key].get('n', '')

                    ignition_sensors.append({
                        'unit_id': unit_id,
                        'unit_name': unit_name,
                        'sensor_id': int(sens_id),
                        'name': sens_data.get('n', ''),
                        'type': sens_data.get('t', ''),
                        'description': sens_data.get('d', ''),
                        'parameter': sens_data.get('p', ''),
                        'metric': sens_data.get('m', ''),
                        'calibration_table': sens_data.get('tbl', []),
                        'validator_type': sens_data.get('vt', 0),
                        'validator_sensor_id': validator_sensor_id,
                        'validator_sensor_name': validator_sensor_name,
                        'config': config,
                        'created': sens_data.get('ct', 0),
                        'modified': sens_data.get('mt', 0),
                    })

        return ignition_sensors

    async def get_available_flags_info(self) -> Dict[str, Any]:
        """Return documentation about available Wialon API flags."""
        return {
            "flags": {
                "FLAG_BASE": {"value": 1, "hex": "0x00000001", "description": "Base info (id, name)"},
                "FLAG_CUSTOM_PROPS": {"value": 2, "hex": "0x00000002", "description": "Custom properties"},
                "FLAG_BILLING": {"value": 4, "hex": "0x00000004", "description": "Billing info (bact)"},
                "FLAG_CUSTOM_FIELDS": {"value": 8, "hex": "0x00000008", "description": "Custom fields (flds)"},
                "FLAG_IMAGE": {"value": 16, "hex": "0x00000010", "description": "Image/icon (uri)"},
                "FLAG_MESSAGES": {"value": 32, "hex": "0x00000020", "description": "Messages params"},
                "FLAG_GUID": {"value": 64, "hex": "0x00000040", "description": "GUID"},
                "FLAG_ADMIN_FIELDS": {"value": 128, "hex": "0x00000080", "description": "Admin fields (aflds)"},
                "FLAG_ACTIVATION": {"value": 256, "hex": "0x00000100", "description": "Activation status (act)"},
                "FLAG_LAST_MSG": {"value": 1024, "hex": "0x00000400", "description": "Last message and position (pos, lmsg)"},
                "FLAG_SENSORS": {"value": 4096, "hex": "0x00001000", "description": "Sensors configuration (sens)"},
                "FLAG_COUNTERS": {"value": 8192, "hex": "0x00002000", "description": "Counters - mileage, engine hours (cfl)"},
                "FLAG_MAINTENANCE": {"value": 32768, "hex": "0x00008000", "description": "Maintenance data (mnt)"},
                "FLAG_COMMANDS": {"value": 524288, "hex": "0x00080000", "description": "Commands (cmds)"},
                "FLAG_MSG_PARAMS": {"value": 1048576, "hex": "0x00100000", "description": "Message parameters (prms)"},
                "FLAG_CONNECTION": {"value": 2097152, "hex": "0x00200000", "description": "Connection state"},
                "FLAG_POSITION": {"value": 4194304, "hex": "0x00400000", "description": "Position data"},
            },
            "common_combinations": {
                "basic": {"value": 1, "description": "Just id and name"},
                "with_position": {"value": 1025, "description": "Basic + last message with position"},
                "full_list": {"value": 1057801, "description": "Optimized for list view"},
                "maximum": {"value": 4194303, "description": "All available data (0x3FFFFF)"},
            },
            "response_fields": {
                "nm": "Name - назва об'єкта",
                "id": "Unit ID - унікальний ідентифікатор",
                "act": "Activation status (0=inactive, 1=active) - статус активації",
                "act_code_tme": "Activation code time - час активаційного коду",
                "act_reason": "Activation reason - причина активації",
                "bact": "Billing activation - ID білінгового акаунту",
                "ph": "Phone number 1 - телефон 1",
                "ph2": "Phone number 2 - телефон 2",
                "uid": "Unique ID 1 - унікальний ID 1 (IMEI)",
                "uid2": "Unique ID 2 - унікальний ID 2",
                "hw": "Hardware type - тип пристрою",
                "uri": "Icon URI - шлях до іконки",
                "pos": "Position object {x, y, z, s, c, sc, t} - позиція",
                "lmsg": "Last message - останнє повідомлення",
                "prms": "Parameters from tracker - параметри від трекера",
                "sens": "Sensors configuration - конфігурація сенсорів",
                "flds": "Custom fields - кастомні поля",
                "aflds": "Admin fields - адмін поля",
                "cfl": "Counters flags - прапорці лічильників",
                "cnm": "Mileage counter - лічильник пробігу (м)",
                "cneh": "Engine hours counter - лічильник моточасів (сек)",
                "cnkb": "GPRS traffic counter - лічильник GPRS трафіку (KB)",
                "cnm_km": "Mileage counter in km - пробіг в км",
                "cmds": "Available commands - доступні команди",
                "mnt": "Maintenance data - дані техобслуговування",
                "cls": "Class - клас об'єкта (2=unit)",
                "mu": "Measure units (0=metric, 1=US, 2=imperial)",
                "ct": "Creation time - час створення (timestamp)",
                "crt": "Creator ID - ID творця",
                "uacl": "User access level - рівень доступу",
                "ugi": "User group ID - ID групи користувача",
                "gd": "GUID - глобальний унікальний ID",
                "netconn": "Network connection state - стан мережевого з'єднання",
                "dactt": "Deactivation time - час деактивації",
                "ftp": "FTP settings - налаштування FTP",
                "hch": "Health check settings - налаштування перевірки стану",
                "prp": "Properties - додаткові властивості",
                "rfc": "Fuel consumption settings - налаштування витрати палива",
                "rtd": "Route data settings - налаштування маршрутних даних",
                "retr": "Retranslation settings - налаштування ретрансляції",
                "vp": "Video properties - властивості відео",
            }
        }

    def _format_unit_detail(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Format detailed unit data."""
        pos = item.get("pos") or {}
        last_time = pos.get("t", 0)
        is_online = (datetime.utcnow().timestamp() - last_time) < 600 if last_time else False

        # Get counters
        mileage = item.get("cnm", 0)
        engine_hours = item.get("cneh", 0)

        # Get all parameters from prms (tracker data)
        prms = item.get("prms") or {}
        parameters = []
        for param_name, param_data in prms.items():
            if isinstance(param_data, dict):
                value = param_data.get("v")
                # Convert timestamp to readable date
                ct = param_data.get("ct", 0)
                last_update = datetime.fromtimestamp(ct).strftime("%d.%m.%Y, %H:%M:%S") if ct else None

                parameters.append({
                    "name": param_name,
                    "value": value,
                    "last_update": last_update
                })

        # Sort parameters by name
        parameters.sort(key=lambda x: x["name"])

        # Get custom fields
        custom_fields = {}
        for field in item.get("flds", {}).values():
            if isinstance(field, dict):
                custom_fields[field.get("n", "")] = field.get("v", "")

        # Get sensors configuration
        sensors = []
        for sensor_id, sensor in item.get("sens", {}).items():
            if isinstance(sensor, dict):
                sensors.append({
                    "id": sensor.get("id"),
                    "name": sensor.get("n", f"sensor_{sensor_id}"),
                    "type": sensor.get("t", ""),
                    "param": sensor.get("p", ""),
                    "description": sensor.get("d", ""),
                    "unit": sensor.get("m", ""),
                })

        # Sort sensors by name
        sensors.sort(key=lambda x: x["name"])

        # Get device info
        device_type = item.get("hw", "")
        phone = item.get("ph", "")
        phone2 = item.get("ph2", "")
        uid = item.get("uid", "")
        uid2 = item.get("uid2", "")

        # Get engine hours from prms if not in counters
        if not engine_hours:
            eh_param = prms.get("engine_hours", {})
            if isinstance(eh_param, dict):
                engine_hours = eh_param.get("v", 0)

        return {
            "id": item.get("id"),
            "name": item.get("nm", "Unknown"),
            "is_activated": item.get("act", 0) == 1,
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
            "device_type": device_type,
            "phone": phone,
            "phone2": phone2,
            "uid": uid,
            "uid2": uid2,
            "custom_fields": custom_fields,
            "sensors": sensors,
            "parameters": parameters,
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
