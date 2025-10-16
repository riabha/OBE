# 🎓 QUEST OBE Portal

A comprehensive **Outcome-Based Education (OBE) Portal** for managing Course Learning Outcomes (CLOs), assessments, student results, and Continuous Quality Improvement (CQI) actions.

## 📋 Features

### 👥 Multi-Role System
- **Student**: View results, CLO attainment, and personal dashboard
- **Teacher**: Upload results, create assessments, manage CLOs
- **Focal Person**: Monitor CQI actions, department performance
- **Chairman**: Department-level oversight and reports
- **Dean**: Faculty-wide monitoring
- **Controller of Examinations**: University-wide examination management
- **Super Admin**: Complete system administration

### 🎯 Core Functionalities
- ✅ **CLO Management**: Define and track Course Learning Outcomes
- ✅ **Assessment Creation**: Link questions to specific CLOs
- ✅ **Result Upload**: Excel/CSV support for bulk uploads
- ✅ **CLO Attainment Calculation**: Automatic calculation based on assessments
- ✅ **CQI Actions**: Track corrective and preventive actions
- ✅ **Attendance Tracking**: Fallback option for CLO attainment
- ✅ **Reports & Analytics**: Comprehensive reporting system
- ✅ **Department Performance**: Track departmental metrics

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MySQL Database
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/quest-obe-portal.git
   cd quest-obe-portal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp config.env.example config.env
   ```
   
   Edit `config.env` with your database credentials:
   ```env
   DB_HOST=your_database_host
   DB_PORT=your_database_port
   DB_NAME=your_database_name
   DB_USER=your_database_user
   DB_PASSWORD=your_database_password
   JWT_SECRET=your_jwt_secret_key
   ```

4. **Run the application**
   ```bash
   npm start
   # or
   node server.js
   ```

5. **Access the application**
   - Open browser: `http://localhost:30005`
   - Login page: `http://localhost:30005/login`

### 🎭 Demo Accounts

After initialization, you can login with these demo accounts (password: `pass`):

| Role | Email | Password |
|------|-------|----------|
| Student | student@quest.edu.pk | pass |
| Teacher | teacher@quest.edu.pk | pass |
| Focal Person | focal@quest.edu.pk | pass |
| Chairman | chairman@quest.edu.pk | pass |
| Dean | dean@quest.edu.pk | pass |
| Controller | controller@quest.edu.pk | pass |
| Super Admin | superadmin@quest.edu.pk | pass |

## 🗄️ Database Setup

The application automatically creates necessary tables on first run. Manual setup:

```bash
# Test database connection
node scripts/test-db-connection.js

# Create demo users
node scripts/create-demo-users-simple.js
```

### Database Schema
- **users**: User accounts and roles
- **courses**: Course information
- **clos**: Course Learning Outcomes
- **assessments**: Assessment details
- **assessment_questions**: Question-CLO linking
- **results**: Student results
- **clo_attainment**: CLO attainment tracking
- **cqi_actions**: Continuous Quality Improvement actions
- **attendance**: Attendance records
- **department_performance**: Department metrics

## 🌐 Deployment

### Deploy to Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Set environment variables in Vercel**
   ```bash
   vercel env add DB_HOST
   vercel env add DB_PORT
   vercel env add DB_NAME
   vercel env add DB_USER
   vercel env add DB_PASSWORD
   vercel env add JWT_SECRET
   vercel env add NODE_ENV
   ```

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Environment Variables for Production

Required environment variables:
- `DB_HOST`: Database hostname
- `DB_PORT`: Database port
- `DB_NAME`: Database name
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password
- `JWT_SECRET`: Secret key for JWT tokens
- `NODE_ENV`: Set to `production`

## 📚 API Documentation

### Authentication
```
POST /api/auth/login
Body: { email, password }
```

### Courses
```
GET  /api/courses          - Get all courses
POST /api/courses          - Create new course
```

### CLOs
```
GET  /api/clos             - Get all CLOs
POST /api/clos             - Create new CLO
```

### Assessments
```
GET  /api/assessments      - Get all assessments
POST /api/assessments      - Create assessment with CLO linking
```

### Results
```
POST /api/results/upload   - Upload student results (Excel/CSV)
```

### CLO Attainment
```
POST /api/clo-attainment/calculate  - Calculate CLO attainment
GET  /api/clo-attainment-summary    - Get attainment summary
```

### CQI Actions
```
GET  /api/cqi-actions      - Get CQI actions
POST /api/cqi-actions      - Create CQI action
```

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Authentication**: JWT, bcrypt
- **File Upload**: Multer
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Deployment**: Vercel-ready

## 📁 Project Structure

```
quest-obe-portal/
├── api/
│   └── index.js           # API routes for serverless
├── middleware/
│   └── auth.js            # Authentication middleware
├── models/
│   ├── Course.js
│   ├── Department.js
│   └── User.js
├── public/
│   ├── js/
│   │   └── reports-system.js
│   ├── chairman-dashboard-enhanced.html
│   ├── controller-dashboard-enhanced.html
│   ├── dean-dashboard-enhanced.html
│   ├── focal-dashboard-enhanced.html
│   ├── student-dashboard-enhanced.html
│   ├── teacher-dashboard-enhanced.html
│   ├── super-admin-dashboard.html
│   ├── login.html
│   ├── index.html
│   ├── script.js
│   └── styles.css
├── routes/
│   ├── assessments.js
│   ├── auth.js
│   ├── courses.js
│   ├── departments.js
│   ├── outcomes.js
│   ├── reports.js
│   └── users.js
├── scripts/
│   ├── create-demo-users.js
│   ├── create-demo-users-simple.js
│   └── test-db-connection.js
├── config.env.example     # Example environment config
├── server.js              # Main server file
├── vercel.json            # Vercel deployment config
└── package.json
```

## 🔒 Security

- Passwords hashed with bcrypt (12 rounds)
- JWT-based authentication
- SQL injection protection with parameterized queries
- CORS configuration for production
- Environment variables for sensitive data

## 🧪 Testing

```bash
# Test database connection
node scripts/test-db-connection.js

# Create demo users for testing
node scripts/create-demo-users-simple.js
```

## 📝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Authors

- **QUEST University** - Initial work

## 🙏 Acknowledgments

- QUEST University for OBE requirements
- All contributors who helped shape this portal

## 📞 Support

For support, email support@quest.edu.pk or create an issue in the GitHub repository.

## 🔄 Version History

- **v1.0.0** - Initial release with core OBE features
  - Multi-role authentication system
  - CLO management
  - Assessment and result tracking
  - CQI action monitoring
  - Department performance analytics

---

**Made with ❤️ for QUEST University**
