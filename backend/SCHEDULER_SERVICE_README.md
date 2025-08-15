# Backend Scheduler Service

This is a separate Railway service that runs only the scheduler for background fixture processing.

## **Overview**

The scheduler service runs independently from the main backend service to avoid duplicate schedulers across multiple workers.

**Note**: This service uses `railway.scheduler.json` for configuration, while the main backend service uses `railway.toml`. This separation prevents configuration conflicts between services.

## **Files Created**

### **Core Files**
- `app/scheduler.py` - Main scheduler entry point
- `app/scheduler_health.py` - Health check server for Railway
- `Dockerfile.scheduler` - Container build file
- `railway.scheduler.json` - Railway configuration

### **Modified Files**
- `app/main.py` - Removed scheduler startup code

## **Railway Service Setup**

### **1. Create New Service**
- **Service Name**: `backend-scheduler`
- **Source**: Same GitHub repo (`anto2887/Prdiktit`)
- **Root Directory**: `backend/`
- **Branch**: `production`

### **2. Configuration**
- **Port**: `8001`
- **Resources**: 2-4 vCPU, 4-8 GB RAM
- **Start Command**: `python -m app.scheduler_health`
- **Dockerfile**: `Dockerfile.scheduler`
- **Railway Config**: `railway.scheduler.json`

### **3. Environment Variables**
Copy all environment variables from the main backend service:
- Database connection strings
- API keys
- Logging configuration
- All other environment variables

## **How It Works**

### **1. Scheduler Service**
- Runs the `EnhancedSmartScheduler`
- Processes fixtures and predictions
- Makes API calls to Football API
- Updates database with results

### **2. Health Check Server**
- Provides `/health` endpoint for Railway
- Provides `/status` endpoint for monitoring
- Runs alongside the scheduler

### **3. Main Backend Service**
- Handles HTTP requests only
- No background processing
- 4 workers for load balancing
- No duplicate schedulers

## **Deployment Process**

### **Phase 1: Deploy Scheduler Service**
1. Create `backend-scheduler` service in Railway
2. Deploy with new code files
3. Verify scheduler starts and runs

### **Phase 2: Deploy Updated Backend**
1. Deploy backend service with scheduler removed
2. Verify HTTP endpoints still work
3. Verify no scheduler processes running

### **Phase 3: Monitor Both Services**
1. Check scheduler service logs
2. Check backend service logs
3. Verify fixtures are being processed
4. Verify HTTP requests are handled

## **Monitoring**

### **Scheduler Service Health**
- **Endpoint**: `http://backend-scheduler-production-XXXX.up.railway.app:8001/health`
- **Status**: Should return `{"status": "healthy", "scheduler_status": "running"}`

### **Scheduler Service Status**
- **Endpoint**: `http://backend-scheduler-production-XXXX.up.railway.app:8001/status`
- **Purpose**: Detailed status information for monitoring

### **Logs**
- **Scheduler Service**: Check Railway logs for scheduler activity
- **Backend Service**: Check Railway logs for HTTP requests
- **Database**: Monitor fixture and prediction updates

## **Troubleshooting**

### **Scheduler Not Running**
1. Check scheduler service logs
2. Verify environment variables are set
3. Check database connectivity
4. Verify API keys are valid

### **Health Check Failing**
1. Check if scheduler process is running
2. Verify port 8001 is accessible
3. Check for errors in scheduler startup
4. Verify all dependencies are installed

### **No Fixture Updates**
1. Check scheduler service logs
2. Verify Football API connectivity
3. Check rate limiting status
4. Verify database permissions

## **Benefits**

### **1. Eliminates Duplicate Schedulers**
- **Before**: 4 workers × 1 scheduler = 4 schedulers
- **After**: 1 scheduler service × 1 scheduler = 1 scheduler

### **2. Maintains HTTP Performance**
- **Backend Service**: 4 workers for HTTP requests
- **Scheduler Service**: 1 worker for background processing

### **3. Better Architecture**
- **Separation of Concerns**: HTTP vs background processing
- **Independent Scaling**: Each service scales based on needs
- **Fault Isolation**: One service failure doesn't affect the other

## **Resource Allocation**

### **Scheduler Service**
- **CPU**: 2-4 vCPU (less than main backend)
- **Memory**: 4-8 GB (sufficient for scheduler)
- **Storage**: Minimal (logs only)

### **Main Backend Service**
- **CPU**: 8 vCPU (maintain current allocation)
- **Memory**: 8 GB (maintain current allocation)
- **Storage**: Same as before

## **Rollback Plan**

If issues occur:
1. **Stop scheduler service** in Railway
2. **Revert backend service** to previous deployment
3. **Restart main backend** with scheduler enabled
4. **Investigate issues** with scheduler service
5. **Fix and redeploy** scheduler service

## **Future Enhancements**

### **1. Scheduler Scaling**
- Add multiple scheduler workers if needed
- Implement scheduler load balancing
- Add scheduler failover

### **2. Monitoring**
- Add metrics collection
- Implement alerting
- Add performance monitoring

### **3. Configuration**
- Add scheduler configuration file
- Implement dynamic configuration updates
- Add scheduler API for management
