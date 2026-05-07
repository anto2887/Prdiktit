# Export commonly used components from core modules
from .config import settings

# Lazy imports to avoid circular dependencies
def get_security_functions():
    """Lazy import security functions to avoid circular dependencies"""
    from .security import (
        create_access_token,
        verify_password,
        get_password_hash,
        get_current_user,
        get_current_active_user
    )
    return {
        'create_access_token': create_access_token,
        'verify_password': verify_password,
        'get_password_hash': get_password_hash,
        'get_current_user': get_current_user,
        'get_current_active_user': get_current_active_user
    }
