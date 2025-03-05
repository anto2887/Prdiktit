# Export schema models for easier imports
from .user import (
    User, UserBase, UserCreate, UserUpdate, 
    UserInDB, UserProfile, UserStats, UserProfileResponse
)

from .token import (
    Token, TokenPayload, TokenData, 
    LoginRequest, LoginResponse, RegistrationResponse
)

# Import everything from prediction.py (which now contains all match schemas too)
from .prediction import (
    # Match schemas
    MatchStatus, TeamInfo, Match, MatchBase, MatchCreate, 
    MatchDetail, MatchList, ScorePrediction, MatchScores,
    
    # Prediction schemas
    PredictionStatus, PredictionBase, PredictionCreate, PredictionUpdate,
    Prediction, PredictionResponse, PredictionList,
    PredictionWithMatch, PredictionWithUser, PredictionComplete,
    BatchPredictionCreate, BatchPredictionResponse,
    
    # Response schemas
    MatchResponse, MatchListResponse, PredictionListResponse
)

from .groups import (
    GroupPrivacyType, MemberRole, MembershipStatus,
    GroupBase, GroupCreate, GroupUpdate, GroupMember,
    Group, GroupDetail, GroupList, GroupMemberList,
    JoinGroupRequest, JoinGroupResponse, MemberAction,
    MemberActionRequest, MemberActionResponse, TeamInfo,
    TeamList, GroupAnalytics, AuditLogEntry, AuditLogList
)

# Add this line to export TeamInfo from groups
from .groups import TeamInfo
