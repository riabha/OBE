# 🎓 QUEST OBE Portal

**Outcome-Based Education Management System for Quaid-e-Awam University of Engineering, Science & Technology**

## 🌟 **Features**

- ✅ **Multi-Role Dashboard System** (Student, Teacher, Admin, Focal Person, Chairman, Dean, Controller)
- ✅ **Course Management** with CLO (Course Learning Outcomes)
- ✅ **Assessment System** with detailed tracking
- ✅ **CQI (Continuous Quality Improvement)** actions
- ✅ **Reports and Analytics** for academic performance
- ✅ **Modern Responsive UI** with Bootstrap
- ✅ **Database Integration** (MySQL + SQLite fallback)
- ✅ **Authentication System** with role-based access

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js (v14 or higher)
- npm or yarn

### **Installation**
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/quest-obe-portal.git

# Navigate to project directory
cd quest-obe-portal

# Install dependencies
npm install

# Start the server
node server.js
```

### **Access the Application**
- **Local URL**: http://localhost:30005
- **Login Page**: http://localhost:30005/login

## 🔑 **Test Accounts**

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@quest.edu.pk | admin123 |
| **Student** | student@quest.edu.pk | pass |
| **Teacher** | teacher@quest.edu.pk | pass |
| **Focal Person** | focal@quest.edu.pk | pass |
| **Chairman** | chairman@quest.edu.pk | pass |
| **Dean** | dean@quest.edu.pk | pass |
| **Controller** | controller@quest.edu.pk | pass |

## 📊 **Dashboard Access**

- **Super Admin**: `/super-admin-dashboard.html`
- **Student**: `/student-dashboard-enhanced.html`
- **Teacher**: `/teacher-dashboard-enhanced.html`
- **Focal Person**: `/focal-dashboard-enhanced.html`
- **Chairman**: `/chairman-dashboard-enhanced.html`
- **Dean**: `/dean-dashboard-enhanced.html`
- **Controller**: `/controller-dashboard-enhanced.html`

## 🛠️ **Technology Stack**

- **Backend**: Node.js, Express.js
- **Database**: MySQL (with SQLite fallback)
- **Frontend**: HTML5, CSS3, JavaScript, Bootstrap 5
- **Authentication**: JWT tokens
- **Icons**: Font Awesome
- **Charts**: Chart.js

## 📁 **Project Structure**

```
quest-obe-portal/
├── public/                 # Frontend files
│   ├── *.html             # Dashboard pages
│   ├── styles.css         # Main stylesheet
│   ├── script.js          # Client-side JavaScript
│   └── quest_logo.png     # QUEST logo
├── api/                   # API routes
├── models/                # Database models
├── routes/                # Express routes
├── middleware/            # Custom middleware
├── server.js              # Main server file
├── package.json           # Dependencies
└── README.md              # This file
```

## 🔧 **Configuration**

### **Environment Variables**
Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=your_database_host
DB_PORT=your_database_port
DB_NAME=your_database_name
DB_USER=your_database_user
DB_PASSWORD=your_database_password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret

# Server Configuration
PORT=30005
NODE_ENV=development
```

## 🌐 **Deployment**

This project is deployed on **Vercel**.

For detailed deployment instructions, see [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md)

### Quick Vercel Deployment

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables (see guide)
4. Deploy!

**Live Site**: https://www.obe.org.pk

## 📝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 **Authors**

- **QUEST Development Team** - *Initial work*

## 🙏 **Acknowledgments**

- Quaid-e-Awam University of Engineering, Science & Technology
- Bootstrap team for the amazing UI framework
- Font Awesome for the beautiful icons

---

**Made with ❤️ for QUEST University**