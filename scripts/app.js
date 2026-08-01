// app.js - Main Application Logic

document.addEventListener('DOMContentLoaded', () => {
    // 1. Navigation & Routing
    const viewContainer = document.getElementById('view-container');
    const pageTitle = document.getElementById('page-title');
    const navItems = document.querySelectorAll('.nav-item');

    // Mock Data
    const mockProjects = [
        { id: 1, title: 'AI Marketing Video for SaaS', description: 'Create a 60-second explainer video highlighting the AI features of our SaaS product.', skills: ['Video Editing', 'AI Voiceover'], status: 'open' },
        { id: 2, title: 'Educational AI History Series', description: 'Need a series of 5 short videos explaining the history of AI neural networks.', skills: ['Animation', 'Scriptwriting'], status: 'allocated' },
        { id: 3, title: 'Generative AI Art Showcase', description: 'Compile various generative AI artworks into a seamless, beat-synced music video.', skills: ['AI Art Generation', 'Video Editing'], status: 'open' }
    ];

    const mockTasks = {
        todo: [
            { id: 101, title: 'Draft script for AI Marketing Video', deadline: '2 days', project: 'SaaS Video' }
        ],
        inprogress: [
            { id: 102, title: 'Generate AI voiceovers', deadline: 'Tomorrow', project: 'Educational Series' }
        ],
        completed: [
            { id: 103, title: 'Render initial cut', deadline: 'Done', project: 'Generative AI Showcase' }
        ]
    };

    const mockMarketplaceVideos = [
        { id: 201, title: 'Future City Scape (4K AI Generated)', creator: 'NeoVision', price: '45.00', isAI: true },
        { id: 202, title: 'Corporate Presentation Template', creator: 'BusinessPro', price: '25.00', isAI: false },
        { id: 203, title: 'AI Avatar Explainer Base', creator: 'SynthMedia', price: '60.00', isAI: true },
        { id: 204, title: 'Abstract Neural Net Animation', creator: 'DataDreams', price: '30.00', isAI: true }
    ];

    function routeTo(route) {
        // Update Active Nav Item
        navItems.forEach(item => {
            if (item.dataset.route === route) {
                item.classList.add('active');
                pageTitle.textContent = item.querySelector('span').textContent;
            } else {
                item.classList.remove('active');
            }
        });

        // Load Template
        const templateId = `tpl-${route}`;
        const template = document.getElementById(templateId);
        
        if (template) {
            viewContainer.innerHTML = '';
            viewContainer.appendChild(template.content.cloneNode(true));
            
            // Execute view-specific logic
            initViewLogic(route);
        } else {
            viewContainer.innerHTML = '<div style="color:var(--text-secondary); text-align:center; margin-top:50px;">View not found</div>';
        }
        
        // Update URL hash
        window.location.hash = `#/${route}`;
    }

    function initViewLogic(route) {
        if (route === 'projects') {
            const list = document.getElementById('projects-list');
            if (list) {
                list.innerHTML = mockProjects.map(p => Components.ProjectCard(p)).join('');
            }
        } else if (route === 'my-work') {
            const todo = document.getElementById('todo-tasks');
            const inprogress = document.getElementById('inprogress-tasks');
            const completed = document.getElementById('completed-tasks');
            
            if (todo) todo.innerHTML = mockTasks.todo.map(t => Components.TaskItem(t)).join('');
            if (inprogress) inprogress.innerHTML = mockTasks.inprogress.map(t => Components.TaskItem(t)).join('');
            if (completed) completed.innerHTML = mockTasks.completed.map(t => Components.TaskItem(t)).join('');
        } else if (route === 'marketplace') {
            const list = document.getElementById('marketplace-list');
            if (list) {
                list.innerHTML = mockMarketplaceVideos.map(v => Components.VideoCard(v)).join('');
            }
        }
    }

    // Handle initial routing
    function handleHashChange() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#/')) {
            const route = hash.replace('#/', '');
            routeTo(route);
        } else {
            routeTo('dashboard');
        }
    }

    // Event Listeners
    window.addEventListener('hashchange', handleHashChange);
    
    // Initial Load
    handleHashChange();
});
