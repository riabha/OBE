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
- **University Super Admin**: Complete system administration
- **Pro Super Admin**: System-wide configuration and management

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
- Node.js (v22.x recommended)
- MongoDB Database (v5.0 or higher)
- npm package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/riabha/OBE.git
   cd OBE
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
   PORT=3000
   NODE_ENV=production
   
   # MongoDB Connection (Platform Database)
   MONGODB_URI=mongodb://localhost:27017/obe_platform
   # For production with authentication:
   # MONGODB_URI=mongodb://username:password@localhost:27017/obe_platform
   
   # JWT Secret (change to a strong random string)
   JWT_SECRET=your_jwt_secret_key_change_this
   JWT_EXPIRE=7d
   
   # Session Secret (change to a strong random string)
   SESSION_SECRET=your_session_secret_change_this
   ```

4. **Run the application**
   ```bash
   npm start
   ```

5. **Access the application**
   - Open browser: `http://localhost:3000`
   - Login page: `http://localhost:3000/login.html`

## 🗄️ Database Setup

The application uses **MongoDB** for data storage with **automatic database creation** per university.

### Architecture:
- **Platform Database** (`obe_platform`): Stores all university metadata
- **University Databases** (`obe_university_*`): Auto-created for each university
- Each university gets its own isolated MongoDB database

### MongoDB Installation:
```bash
# For Ubuntu/Debian
sudo apt install mongodb-org

# For macOS
brew install mongodb-community

# Start MongoDB service
sudo systemctl start mongod   # Linux
brew services start mongodb-community  # macOS
```

### Manual Database Creation (Optional):
MongoDB databases are created automatically, but you can pre-create if needed:
```bash
mongo
use obe_platform
db.createCollection("universities")
db.createCollection("platformusers")
exit
```

## 🌐 VPS/Production Deployment

### Deployment Steps

1. **Install Node.js 22.x** on your VPS
2. **Install MongoDB** and ensure it's running
3. **Clone your repository**
   ```bash
   git clone https://github.com/riabha/OBE.git
   cd OBE
   ```

4. **Install dependencies**
   ```bash
   npm install --production
   ```

5. **Configure environment variables**
   - Copy `config.env.example` to `config.env`
   - Update with your production MongoDB connection string
   - Set strong JWT and Session secrets

6. **Start the application**
   ```bash
   npm start
   ```

7. **Use PM2 for process management** (recommended)
   ```bash
   npm install -g pm2
   pm2 start server.js --name quest-obe
   pm2 startup
   pm2 save
   ```

### Environment Variables Required

For production deployment:

```env
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/obe_platform
JWT_SECRET=your_strong_random_secret
JWT_EXPIRE=7d
SESSION_SECRET=your_strong_random_session_secret
```

### Deployment Checklist

1. ✅ Install Node.js 22.x on VPS
2. ✅ Install and configure MongoDB
3. ✅ Start MongoDB service
4. ✅ Clone repository
5. ✅ Install dependencies
6. ✅ Configure environment variables (MongoDB URI)
7. ✅ Set up reverse proxy (Nginx/Apache or via aaPanel)
8. ✅ Configure SSL/HTTPS
9. ✅ Set up PM2 for process management
10. ✅ Configure firewall rules

## 📚 API Documentation

### Authentication
```
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/check
POST /api/auth/logout
```

### Users
```
GET    /api/users          - Get all users
POST   /api/users          - Create new user
PUT    /api/users/:id      - Update user
DELETE /api/users/:id      - Delete user
```

### Courses
```
GET    /api/courses        - Get all courses
POST   /api/courses        - Create new course
PUT    /api/courses/:id    - Update course
DELETE /api/courses/:id    - Delete course
```

### Departments
```
GET    /api/departments    - Get all departments
POST   /api/departments    - Create new department
PUT    /api/departments/:id    - Update department
DELETE /api/departments/:id    - Delete department
```

### Outcomes (CLOs)
```
GET    /api/outcomes       - Get all outcomes
POST   /api/outcomes       - Create new outcome
PUT    /api/outcomes/:id   - Update outcome
DELETE /api/outcomes/:id   - Delete outcome
```

### Assessments
```
GET    /api/assessments           - Get all assessments
POST   /api/assessments           - Create assessment
PUT    /api/assessments/:id       - Update assessment
DELETE /api/assessments/:id       - Delete assessment
POST   /api/assessments/upload    - Upload assessment results
```

### Reports
```
GET /api/reports/clo-attainment    - CLO attainment reports
GET /api/reports/student-performance - Student performance reports
GET /api/reports/department        - Department reports
```

## 🛠️ Technology Stack

- **Backend**: Node.js 22.x, Express.js
- **Database**: MongoDB 5.0+ with Mongoose ODM
- **Authentication**: JWT, bcrypt, Passport.js
- **File Upload**: Multer
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Architecture**: Multi-tenancy with automatic database creation

## 📁 Project Structure

```
OBE/
├── middleware/
│   └── auth.js            # Authentication middleware
├── migrations/
│   └── university-schema.js
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
│   ├── university-super-admin-dashboard.html
│   ├── pro-super-admin-dashboard.html
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
├── utils/
│   └── database-manager.js
├── config.env.example     # Example environment config
├── server.js              # Main server file
└── package.json
```

## 🔒 Security

- Passwords hashed with bcrypt (12 rounds)
- JWT-based authentication
- Session management with express-session
- MongoDB injection protection with Mongoose schema validation
- CORS configuration for production
- Environment variables for sensitive data
- Isolated database per university for data security

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

- **v1.0.1** - Current release
  - Multi-role authentication system
  - CLO management
  - Assessment and result tracking
  - CQI action monitoring
  - Department performance analytics
  - MongoDB integration with Mongoose ODM
  - Multi-university SaaS architecture
  - Automatic database creation per university
  - VPS deployment ready

---

## 🔄 Auto-Deployment Status

✅ **Auto-deployment is ACTIVE!** - Push to GitHub and watch it deploy automatically!

**Last Update**: Testing auto-deployment webhook - October 20, 2025

---

**Made with ❤️ for QUEST University**
