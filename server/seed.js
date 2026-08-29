require('dotenv').config();
const connectDB = require('./config/database');
const User = require('./models/User');
const Project = require('./models/Project');
const Task = require('./models/Task');
const Milestone = require('./models/Milestone');
const Issue = require('./models/Issue');
const Risk = require('./models/Risk');
const Activity = require('./models/Activity');
const Notification = require('./models/Notification');

async function seed() {
  await connectDB();
  console.log('Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    Task.deleteMany({}),
    Milestone.deleteMany({}),
    Issue.deleteMany({}),
    Risk.deleteMany({}),
    Activity.deleteMany({}),
    Notification.deleteMany({}),
  ]);

  console.log('Creating demo users...');
  const admin = await User.create({
    name: 'System Admin',
    email: 'admin@projectpulse.com',
    password: 'Admin123',
    role: 'admin',
    department: 'Administration',
  });
  const manager = await User.create({
    name: 'Avinash Rao',
    email: 'manager@projectpulse.com',
    password: 'Manager123',
    role: 'manager',
    department: 'Engineering',
  });
  const member = await User.create({
    name: 'Rahul Sharma',
    email: 'member@projectpulse.com',
    password: 'Member123',
    role: 'member',
    department: 'Engineering',
  });
  const member2 = await User.create({
    name: 'Priya Nair',
    email: 'priya@projectpulse.com',
    password: 'Member123',
    role: 'member',
    department: 'Design',
  });
  const viewer = await User.create({
    name: 'Dr. Kavita Menon',
    email: 'viewer@projectpulse.com',
    password: 'Viewer123',
    role: 'viewer',
    department: 'Faculty',
  });

  console.log('Creating demo projects...');
  const projectsData = [
    {
      name: 'Smart Campus Management System',
      code: 'SCMS-01',
      description: 'A unified platform to manage campus attendance, resources and facilities.',
      category: 'Web Application',
      manager: manager._id,
      teamMembers: [manager._id, member._id, member2._id, viewer._id],
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-10-15'),
      budget: 100000,
      usedBudget: 65000,
      priority: 'High',
      status: 'Active',
      department: 'Engineering',
      client: 'College Administration',
    },
    {
      name: 'AI-Based Student Assistant',
      code: 'AISA-02',
      description: 'A chatbot assistant to help students with academic queries.',
      category: 'AI/ML',
      manager: manager._id,
      teamMembers: [manager._id, member2._id],
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-11-01'),
      budget: 75000,
      usedBudget: 20000,
      priority: 'Medium',
      status: 'Planning',
      department: 'Computer Science',
    },
    {
      name: 'Online Coding Platform',
      code: 'OCP-03',
      description: 'A judge-based coding practice and contest platform for students.',
      category: 'Web Application',
      manager: manager._id,
      teamMembers: [manager._id, member._id],
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-08-20'),
      budget: 50000,
      usedBudget: 48000,
      priority: 'Critical',
      status: 'Delayed',
      department: 'Computer Science',
    },
  ];
  const projects = await Project.insertMany(projectsData);

  console.log('Creating demo tasks...');
  const taskTitles = [
    ['Design database schema', 'Backend'],
    ['Develop Login API', 'Backend'],
    ['Build dashboard UI', 'Frontend'],
    ['Implement Kanban board', 'Frontend'],
    ['Setup Socket.IO real-time sync', 'Backend'],
    ['Write API documentation', 'Docs'],
    ['Integrate Chart.js analytics', 'Frontend'],
    ['Configure JWT authentication', 'Backend'],
    ['Test task assignment flow', 'QA'],
    ['Design project health algorithm', 'Backend'],
    ['Create responsive mobile layout', 'Frontend'],
    ['Setup MongoDB indexes', 'Backend'],
    ['Build notification system', 'Backend'],
    ['UAT with faculty', 'QA'],
    ['Deploy to production', 'DevOps'],
  ];
  const statuses = ['Backlog', 'To Do', 'In Progress', 'Review', 'Completed'];
  const priorities = ['Low', 'Medium', 'High', 'Critical'];
  const assignees = [manager._id, member._id, member2._id];

  const tasks = [];
  for (let i = 0; i < taskTitles.length; i++) {
    const [title, tag] = taskTitles[i];
    const status = statuses[i % statuses.length];
    tasks.push({
      title,
      description: `${title} for the project.`,
      project: projects[i % projects.length]._id,
      assignedTo: assignees[i % assignees.length],
      createdBy: manager._id,
      priority: priorities[i % priorities.length],
      status,
      progress: status === 'Completed' ? 100 : (i * 13) % 100,
      dueDate: new Date(Date.now() + (i - 5) * 86400000),
      estimatedHours: 8 + i,
      tags: [tag],
    });
  }
  await Task.insertMany(tasks);

  console.log('Creating demo milestones...');
  const milestoneNames = [
    'Requirements Completed',
    'UI Completed',
    'Backend Completed',
    'Testing Completed',
    'Final Deployment',
  ];
  const milestones = milestoneNames.map((name, i) => ({
    name,
    description: `${name} milestone`,
    project: projects[0]._id,
    owner: manager._id,
    dueDate: new Date(Date.now() + (i - 1) * 7 * 86400000),
    status: i < 2 ? 'Completed' : i === 2 ? 'In Progress' : 'Pending',
    completion: i < 2 ? 100 : i === 2 ? 50 : 0,
    order: i,
  }));
  await Milestone.insertMany(milestones);

  console.log('Creating demo issues...');
  const issueData = [
    ['Login fails on mobile Safari', 'Critical', 'Open'],
    ['Kanban drag-drop glitch', 'High', 'Investigating'],
    ['Dark mode contrast issue', 'Low', 'Open'],
    ['Notification bell not updating count', 'Medium', 'In Progress'],
    ['Budget chart rendering incorrectly', 'Medium', 'Resolved'],
    ['Socket disconnect on tab switch', 'High', 'Open'],
    ['Task filter not persisting', 'Low', 'Closed'],
    ['Slow project list load time', 'Medium', 'Investigating'],
  ];
  const issues = issueData.map(([title, priority, status], i) => ({
    title,
    description: `${title} — reported during testing.`,
    project: projects[i % projects.length]._id,
    reportedBy: member._id,
    assignedTo: manager._id,
    priority,
    status,
  }));
  await Issue.insertMany(issues);

  console.log('Creating demo risks...');
  const riskData = [
    ['Key developer unavailability', 4, 4],
    ['Scope creep from stakeholders', 3, 3],
    ['Third-party API rate limits', 2, 3],
    ['Server cost overrun', 3, 4],
    ['Data privacy compliance gap', 2, 5],
    ['Delayed faculty feedback cycle', 3, 2],
  ];
  const risks = riskData.map(([name, probability, impact], i) => ({
    name,
    description: `Risk: ${name}`,
    project: projects[i % projects.length]._id,
    owner: manager._id,
    probability,
    impact,
    mitigation: 'Under review by project manager.',
  }));
  await Risk.insertMany(risks);

  console.log('Creating demo activity log...');
  const activities = [];
  for (let i = 0; i < 20; i++) {
    activities.push({
      project: projects[i % projects.length]._id,
      user: [manager._id, member._id, member2._id, admin._id][i % 4],
      action: ['created task', 'updated project', 'changed task status', 'commented', 'reported issue'][i % 5],
      details: `Demo activity record #${i + 1}`,
    });
  }
  await Activity.insertMany(activities);

  console.log('Creating demo notifications...');
  const notifs = [];
  for (let i = 0; i < 10; i++) {
    notifs.push({
      user: member._id,
      message: [
        'You were assigned a new task.',
        'Deadline approaching tomorrow.',
        'Your task was marked completed.',
        'New comment on your task.',
        'A new issue was reported.',
      ][i % 5],
      type: 'info',
      project: projects[i % projects.length]._id,
      read: i % 3 === 0,
    });
  }
  await Notification.insertMany(notifs);

  console.log('\nSeed complete!');
  console.log('Demo accounts:');
  console.log('  Admin:   admin@projectpulse.com / Admin123');
  console.log('  Manager: manager@projectpulse.com / Manager123');
  console.log('  Member:  member@projectpulse.com / Member123');
  console.log('  Viewer:  viewer@projectpulse.com / Viewer123');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
