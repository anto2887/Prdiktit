# 🧪 Phase 2 Testing Guide - Group-Relative Activation System

## **Overview**

Phase 2 implements the group-relative activation system across all services. This guide shows you how to test each component to ensure everything is working correctly.

## **🚀 Quick Start Testing**

### **Option 1: Python Script (Recommended)**
```bash
# Install requests if needed
pip install requests

# Run the comprehensive test
python test_phase2.py
```

### **Option 2: Curl Commands**
```bash
# Make the script executable
chmod +x test_phase2_curl.sh

# Run the curl-based tests
./test_phase2_curl.sh
```

### **Option 3: Manual Testing**
Test each endpoint individually using the commands below.

## **🧪 Individual Test Endpoints**

### **1. Migration Status Check**
```bash
curl -X GET "https://backend-production-4894.up.railway.app/api/v1/admin/test-group-activation-migration"
```
**Expected Result:**
- ✅ All 3 columns exist: `created_week`, `activation_week`, `next_rivalry_week`
- ✅ All groups have activation data populated
- ✅ Migration status shows as complete

### **2. Rivalry Service Test**
```bash
curl -X GET "https://backend-production-4894.up.railway.app/api/v1/admin/test-rivalry-activation"
```
**Expected Result:**
- ✅ Each group shows correct activation weeks
- ✅ Rivalry weeks are calculated correctly:
  - Week 1-5: No rivalry weeks (before activation)
  - Week 6: First rivalry week (at activation)
  - Week 10, 14, 18: Subsequent rivalry weeks (every 4 weeks)

### **3. Analytics Service Test**
```bash
curl -X GET "https://backend-production-4894.up.railway.app/api/v1/admin/test-analytics-activation"
```
**Expected Result:**
- ✅ Analytics available after group activation week
- ✅ Proper fallback logic for users not in groups
- ✅ Clear activation reasons provided

### **4. Bonus Service Test**
```bash
curl -X GET "https://backend-production-4894.up.railway.app/api/v1/admin/test-bonus-activation"
```
**Expected Result:**
- ✅ Bonuses available after group activation week
- ✅ Consistent with rivalry and analytics activation

## **📊 What to Look For**

### **✅ Success Indicators**
1. **All endpoints return 200 status codes**
2. **Migration shows 3 columns exist**
3. **All groups have activation data**
4. **Week calculations are correct:**
   - Week 1-5: Features locked
   - Week 6: Features unlock
   - Week 6, 10, 14, 18: Rivalry weeks

### **❌ Failure Indicators**
1. **500 errors** - Check backend logs
2. **Missing columns** - Migration may have failed
3. **Incorrect week calculations** - Logic error in services
4. **Empty test results** - Database connection issues

## **🔍 Detailed Analysis**

### **Rivalry Week Logic**
```
Week 1-5: No rivalries (before activation)
Week 6: First rivalry (at activation)
Week 10: Second rivalry (4 weeks later)
Week 14: Third rivalry (8 weeks after activation)
Week 18: Fourth rivalry (12 weeks after activation)
```

### **Group Activation Pattern**
```
created_week = 1 (when group was created)
activation_week = 6 (5 weeks after creation)
next_rivalry_week = 7 (first rivalry week)
```

## **🐛 Troubleshooting**

### **Common Issues**

#### **1. Migration Failed**
```bash
# Check if columns exist
curl -X GET "https://backend-production-4894.up.railway.app/api/v1/admin/test-group-activation-migration"

# If failed, re-run migration
curl -X POST "https://backend-production-4894.up.railway.app/api/v1/admin/migrate-group-activation-system"
```

#### **2. Service Errors**
- Check backend logs for Python errors
- Verify database connections
- Ensure all imports are working

#### **3. Week Calculation Issues**
- Verify `activation_week` values in database
- Check rivalry service logic
- Ensure proper week arithmetic

### **Debug Commands**
```bash
# Check specific group data
curl -X GET "https://backend-production-4894.up.railway.app/api/v1/admin/test-group-activation-migration" | jq '.sample_groups[] | select(.id == 1)'

# Test specific service
curl -X GET "https://backend-production-4894.up.railway.app/api/v1/admin/test-rivalry-activation" | jq '.test_results[] | select(.group_id == 1)'
```

## **📈 Performance Testing**

### **Load Testing**
```bash
# Test multiple concurrent requests
for i in {1..10}; do
  curl -X GET "https://backend-production-4894.up.railway.app/api/v1/admin/test-rivalry-activation" &
done
wait
```

### **Response Time Monitoring**
```bash
# Test response times
time curl -X GET "https://backend-production-4894.up.railway.app/api/v1/admin/test-rivalry-activation"
```

## **🎯 Success Criteria**

Phase 2 is successful when:

1. ✅ **Migration completed** - All groups have activation data
2. ✅ **Rivalry service works** - Correct rivalry week calculations
3. ✅ **Analytics service works** - Group-relative activation
4. ✅ **Bonus service works** - Group-relative activation
5. ✅ **No errors** - All endpoints return 200 status
6. ✅ **Logic correct** - Week calculations match expected pattern

## **🚀 Next Steps**

After successful Phase 2 testing:

1. **Phase 3**: Frontend integration with progress bars
2. **Phase 4**: Transaction safety implementation
3. **Phase 5**: Champion Challenge improvements
4. **Phase 6**: UI changes and final testing

## **📞 Support**

If you encounter issues:

1. Check backend logs for detailed error messages
2. Verify database connectivity
3. Test individual endpoints to isolate problems
4. Review the extensive logging added to each service

---

**Happy Testing! 🎉**
