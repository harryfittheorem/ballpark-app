"""Import the hyphenated command-line helper without executing its entrypoint."""
import importlib.util
from pathlib import Path
def load_preview():
    spec=importlib.util.spec_from_file_location('crm_preview',Path(__file__).with_name('crm-preview.py'))
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
