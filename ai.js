// Devin BrainJet - Hybrid AI Assistant
// Offline: rule-based smart assistant with NLP understanding
// Online: optional boost via free public APIs (Pollinations.ai - no API key required)

const BrainJetAI = (() => {
  const ONLINE_ENDPOINT = 'https://text.pollinations.ai/openai';

  const SYSTEM_PROMPT = `You are "Jet", the personal AI inside Devin BrainJet — a life-planning PWA for a busy man who is a husband, father, and farm manager. Be warm, encouraging, concise (2-4 sentences). Help with planning advice, time management, farm tips, mind/spiritual reflection, family balance, and task prioritization. End with a brief actionable suggestion when relevant.`;

  // ===== Offline intent detection =====
  function detectIntent(text) {
    const t = text.toLowerCase().trim();
    if (/^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))/i.test(t)) return 'greet';
    if (/(thank|thanks|thx|appreciate)/i.test(t)) return 'thanks';
    if (/(bye|goodbye|see you|later)/i.test(t)) return 'bye';
    if (/(add|create|new|schedule|set|make).*(task|plan|reminder|todo)/i.test(t)) return 'add_plan';
    if (/(what|show|list|view|see).*(today|due|pending|task|plan|schedule)/i.test(t)) return 'show_today';
    if (/(overdue|late|missed)/i.test(t)) return 'show_overdue';
    if (/(this week|week|weekly)/i.test(t)) return 'show_week';
    if (/(stats|progress|summary|how am i|productivity)/i.test(t)) return 'show_stats';
    if (/(farm|crop|plant|harvest|livestock|cattle|chicken|goat|garden)/i.test(t)) return 'farm_advice';
    if (/(stress|tired|overwhelm|anxious|worried|burnout)/i.test(t)) return 'wellness';
    if (/(family|wife|kid|child|son|daughter|father|husband)/i.test(t)) return 'family_advice';
    if (/(prioriti|focus|important|urgent)/i.test(t)) return 'prioritize';
    if (/(motivat|inspire|encourage|quote)/i.test(t)) return 'motivate';
    if (/(time manage|productive|organize|plan)/i.test(t)) return 'time_advice';
    if (/(help|what can you|how do)/i.test(t)) return 'help';
    if (/(weather|temperature|forecast)/i.test(t)) return 'weather';
    if (/(report|pdf|download|export)/i.test(t)) return 'report';
    return 'general';
  }

  // ===== Offline knowledge base =====
  const responses = {
    greet: () => {
      const hour = new Date().getHours();
      const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      const greets = [
        `Good ${part}! 🌅 I'm Jet, your BrainJet assistant. How can I help organize your day?`,
        `Hey there! ☕ Ready to conquer the day? Try asking me "what's due today?"`,
        `Hello! 👋 Whether it's mind, farm, or family — I'm here to help you stay on track.`
      ];
      return greets[Math.floor(Math.random() * greets.length)];
    },
    thanks: () => ['You\'re welcome! 🙏 Keep crushing it.', 'Anytime! 💪 That\'s what I\'m here for.', 'My pleasure! Stay focused. 🎯'][Math.floor(Math.random() * 3)],
    bye: () => 'Goodbye! 👋 I\'ll keep your plans safe. See you soon!',
    help: () => `I can help you with:
• <strong>Plans & Tasks</strong> — "show today's tasks", "what's overdue?"
• <strong>Farm advice</strong> — crop timing, livestock care tips
• <strong>Family balance</strong> — being present as dad & husband
• <strong>Wellness</strong> — stress, burnout, motivation
• <strong>Productivity</strong> — prioritization, time blocks
• <strong>Reports</strong> — "generate a PDF report"

Try the suggestion chips below 👇`,
    add_plan: () => `To add a new plan, click the <strong>+ Add Plan</strong> button at the top, or press <strong>N</strong> on your keyboard. Fill in title, category (mind/farm/task), due date, and priority. I'll remind you when it's due! 🔔`,
    show_today: (ctx) => {
      const today = ctx.plans.filter(p => p.status !== 'done' && isToday(p.dueDate));
      if (!today.length) return 'No tasks due today! 🎉 Great chance to plan tomorrow or rest a bit.';
      return `You have <strong>${today.length}</strong> task(s) due today:\n${today.slice(0, 5).map(p => `• ${p.title} [${p.priority}]`).join('\n')}${today.length > 5 ? `\n…and ${today.length - 5} more.` : ''}`;
    },
    show_overdue: (ctx) => {
      const od = ctx.plans.filter(p => p.status !== 'done' && isOverdue(p.dueDate));
      if (!od.length) return 'Nothing overdue! ✨ You\'re on top of things.';
      return `⚠️ <strong>${od.length}</strong> overdue item(s):\n${od.slice(0, 5).map(p => `• ${p.title}`).join('\n')}\n\nTip: handle the highest priority first.`;
    },
    show_week: (ctx) => {
      const w = ctx.plans.filter(p => p.status !== 'done' && isThisWeek(p.dueDate));
      return `This week: <strong>${w.length}</strong> active plan(s). Highest priority: ${w.filter(p => p.priority === 'high').length} 🔴.`;
    },
    show_stats: (ctx) => {
      const total = ctx.plans.length;
      const done = ctx.plans.filter(p => p.status === 'done').length;
      const rate = total ? Math.round(done / total * 100) : 0;
      return `📊 <strong>Stats</strong>: ${done}/${total} completed (${rate}%). ${rate >= 70 ? 'Excellent work! 🏆' : rate >= 40 ? 'Solid progress! 💪' : 'Keep going — every step counts! 🌱'}`;
    },
    farm_advice: () => {
      const tips = [
        '🌾 Check soil moisture in the morning — it tells you 80% of what plants need.',
        '🐓 Livestock thrive on routine. Feed at the same time daily for healthier yields.',
        '🌱 Rotate crops every season to prevent soil depletion and pests.',
        '☔ Track rainfall — too much in flowering stage hurts most crops.',
        '🔧 Maintain tools weekly. A sharp blade saves hours of labor.',
        '📅 Schedule planting around your lunar/seasonal calendar for best results.'
      ];
      return tips[Math.floor(Math.random() * tips.length)];
    },
    wellness: () => {
      const tips = [
        '🫁 Breathe deeply 4 counts in, 6 counts out. Repeat 3 times. Resets your nervous system.',
        '💧 Drink water first. Dehydration mimics anxiety.',
        '🌳 Take a 10-min walk outside — nature is medicine.',
        '😴 Cut tomorrow\'s list to 3 essentials. Sleep is non-negotiable.',
        '🧘 Pause. Inhale gratitude, exhale stress. You\'re doing more than you think.',
        '☕ A short break now saves 2 hours of fatigue later. Take it.'
      ];
      return tips[Math.floor(Math.random() * tips.length)];
    },
    family_advice: () => {
      const tips = [
        '👨‍👩‍👧 The best gift to your kids isn\'t time — it\'s undivided attention. Even 15 mins matters.',
        '💛 Ask your wife "how can I support you this week?" — it changes everything.',
        '🍽️ Family meals without screens build memories that outlast achievements.',
        '📝 Schedule family time like a meeting. What\'s on the calendar gets done.',
        '🤝 Lead by presence, not perfection. Your kids notice you trying.',
        '💞 A 5-minute check-in with your spouse daily prevents weeks of miscommunication.'
      ];
      return tips[Math.floor(Math.random() * tips.length)];
    },
    prioritize: (ctx) => {
      const high = ctx.plans.filter(p => p.status !== 'done' && p.priority === 'high');
      if (high.length) return `🎯 Focus on these <strong>${high.length}</strong> high-priority items:\n${high.slice(0,3).map(p => `• ${p.title}`).join('\n')}\n\nDo the hardest one first while energy is high.`;
      return '🎯 Eisenhower rule: Important + Urgent → DO. Important + Not Urgent → SCHEDULE. Not Important + Urgent → DELEGATE. Not Important + Not Urgent → DELETE.';
    },
    motivate: () => {
      const quotes = [
        '"You don\'t have to be great to start, but you have to start to be great." — Zig Ziglar 🌟',
        '"Discipline is choosing between what you want now and what you want most." — Abraham Lincoln 💎',
        '"A goal without a plan is just a wish." — Antoine de Saint-Exupéry ✨',
        '"The best time to plant a tree was 20 years ago. The second-best time is now." 🌳',
        '"Small daily improvements over time create stunning results." — Robin Sharma 🚀',
        '"You are the CEO of your life. Hire wisely, fire quickly, lead boldly." 👑'
      ];
      return quotes[Math.floor(Math.random() * quotes.length)];
    },
    time_advice: () => {
      const tips = [
        '⏰ Try the <strong>2-minute rule</strong>: if it takes less than 2 mins, do it now.',
        '📅 Time-block your day: 1 deep work block (90 min), 1 farm block, 1 family block.',
        '🚫 The word "no" is a complete sentence. Protect your priorities.',
        '🌅 First 90 mins of your day = highest ROI. Don\'t spend them on email.',
        '📊 Track your time for 3 days. You\'ll be shocked where it goes.',
        '🎯 One big rock per day. If you do it, the day is a win.'
      ];
      return tips[Math.floor(Math.random() * tips.length)];
    },
    weather: () => '🌤️ I work offline so I can\'t check live weather, but here\'s a tip: check your local forecast every morning before farm work begins.',
    report: () => 'To download a PDF report, go to the <strong>Reports</strong> view from the sidebar and click "Download PDF Report". You\'ll get a beautiful summary of all your plans! 📄',
    general: () => {
      const fallbacks = [
        'Tell me more — are you asking about planning, farm work, family, or something else? 🤔',
        'I want to help! Try asking about today\'s tasks, farm tips, or motivation.',
        'Hmm, let me think… could you rephrase? I\'m great with planning, productivity, and wellness questions.'
      ];
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
  };

  function isToday(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr); const t = new Date();
    return d.toDateString() === t.toDateString();
  }
  function isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date() && !isToday(dateStr);
  }
  function isThisWeek(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr); const t = new Date();
    const diff = (d - t) / (1000 * 60 * 60 * 24);
    return diff >= -1 && diff <= 7;
  }

  async function ask(userText, context = { plans: [] }, options = { online: false }) {
    const intent = detectIntent(userText);
    const offlineAnswer = responses[intent] ? responses[intent](context) : responses.general();

    // If user wants online boost and we have internet
    if (options.online && navigator.onLine) {
      try {
        const planSummary = summarizePlans(context.plans);
        const messages = [
          { role: 'system', content: SYSTEM_PROMPT + '\n\nUser context:\n' + planSummary },
          { role: 'user', content: userText }
        ];
        const res = await fetch(ONLINE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'openai', messages, max_tokens: 220 })
        });
        if (res.ok) {
          const data = await res.json();
          const txt = data.choices?.[0]?.message?.content?.trim();
          if (txt) return { text: txt, source: 'online' };
        }
      } catch (e) {
        console.warn('Online AI failed, using offline:', e);
      }
    }
    return { text: offlineAnswer, source: 'offline', intent };
  }

  function summarizePlans(plans) {
    const total = plans.length;
    const done = plans.filter(p => p.status === 'done').length;
    const overdue = plans.filter(p => p.status !== 'done' && isOverdue(p.dueDate)).length;
    const today = plans.filter(p => p.status !== 'done' && isToday(p.dueDate)).length;
    return `Total plans: ${total}, Completed: ${done}, Due today: ${today}, Overdue: ${overdue}.`;
  }

  function getSuggestions() {
    return [
      "What's due today?",
      "Show overdue tasks",
      "Give me a farm tip",
      "I'm feeling stressed",
      "Motivate me",
      "How am I doing?",
      "Family balance tip",
      "Help me prioritize"
    ];
  }

  return { ask, getSuggestions, detectIntent };
})();
