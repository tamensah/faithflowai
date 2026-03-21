export type HelpItem = {
  q: string;
  a: string;
};

export type HelpSection = {
  /** Portal route this section is primarily about */
  route: string;
  /** Short label shown as section heading */
  label: string;
  items: HelpItem[];
};

export const helpSections: HelpSection[] = [
  {
    route: '/portal',
    label: 'Getting started',
    items: [
      {
        q: 'How do I get into the portal?',
        a: "Go to your church's portal link. Sign in with your email and password — or Google if your church supports it. If your email is already in your church's records, you'll go straight in.",
      },
      {
        q: 'I submitted an access request. What happens next?',
        a: "Your church staff will see your request and approve it. Once they do, come back, sign in, and you'll have full access. Just wait for the green light — you don't need to do anything else.",
      },
      {
        q: 'I forgot my password.',
        a: 'On the sign-in screen, click "Forgot password?" and follow the steps. A reset link will be sent to your email. Check your spam folder if you don\'t see it within a few minutes.',
      },
      {
        q: "It's asking me to 'select a church.' What does that mean?",
        a: "This means your account isn't connected to a church organisation yet. Use the selector shown to pick your church. If it isn't listed, contact your church admin — they may need to add you.",
      },
    ],
  },
  {
    route: '/portal/profile',
    label: 'Profile',
    items: [
      {
        q: 'How do I update my contact details?',
        a: 'Go to Profile, edit your preferred name, phone number, or address, then click Save.',
      },
      {
        q: 'What is a preferred name?',
        a: "It's the name you actually go by — a nickname, shortened name, or anything you prefer. Once set, it appears everywhere in the portal instead of your first name.",
      },
      {
        q: "I can't edit my name or email.",
        a: 'Names and email addresses are managed by your church admin to keep records accurate. Message your admin and they can update it for you.',
      },
      {
        q: 'What does my engagement score mean?',
        a: "It's a read-only score your church uses internally — based on things like attendance and activity. You can see it but can't change it.",
      },
      {
        q: 'Who can see my details?',
        a: 'You control this in the Privacy section of your profile. Set yourself as Public (visible in the directory) or Private (hidden). You can also hide individual fields like email, phone, or address — even if your listing is Public. Church staff can always see your full details.',
      },
    ],
  },
  {
    route: '/portal/directory',
    label: 'Directory',
    items: [
      {
        q: "What is the directory?",
        a: "The directory is a list of your fellow church members — like a congregation contact book. What you see depends on each person's own privacy settings.",
      },
      {
        q: "Why can't I see some members?",
        a: 'Members who set their listing to Private won\'t appear. Members who hid specific fields (like email) will show with those fields blank.',
      },
      {
        q: "Why am I not showing up in the directory?",
        a: 'Check Profile → Privacy. If your Directory visibility is set to Private, switch it to Public and save to become visible.',
      },
    ],
  },
  {
    route: '/portal/events',
    label: 'Events',
    items: [
      {
        q: 'How do I RSVP for an event?',
        a: 'Find the event and click RSVP. That\'s it — you\'re registered immediately.',
      },
      {
        q: 'An event has a registration form. Do I have to fill everything in?',
        a: 'Questions marked with * are required — you won\'t be able to submit without them. The rest are optional.',
      },
      {
        q: 'An event costs money. How do I pay?',
        a: 'Click Register — you\'ll be taken to a secure payment page. Enter your card details, complete payment, and you\'ll return to the portal with your registration confirmed.',
      },
      {
        q: 'How do I cancel my registration?',
        a: 'Find your registration in the events list and click Cancel registration. This removes you from the event immediately. For paid tickets, speak to your church admin about a refund.',
      },
      {
        q: 'What do the registration status labels mean?',
        a: 'Confirmed — you\'re all set. Pending — awaiting payment or admin confirmation. Cancelled — registration was cancelled. Waitlisted — event is full, you\'re on the waiting list.',
      },
    ],
  },
  {
    route: '/portal/messages',
    label: 'Messages',
    items: [
      {
        q: 'How do I send a message?',
        a: 'To message someone new, use the "Start new conversation" dropdown, pick the person, and click Start. Type your message and click Send.',
      },
      {
        q: 'Can I message church staff?',
        a: 'Yes. Staff members appear in the new conversation dropdown. Just select them and start chatting.',
      },
      {
        q: 'How do I attach a file?',
        a: 'Below the message box, use the file picker. Supported types: images (JPG, PNG, GIF), PDFs, Word documents, and plain text. Max size: 10 MB.',
      },
      {
        q: 'What does "X is typing…" mean?',
        a: 'It means the other person is currently typing a reply. It disappears when they stop or send.',
      },
      {
        q: 'How do I know if someone read my message?',
        a: "Below the message thread you'll see a \"Last read\" note showing when the other person last opened the conversation.",
      },
    ],
  },
  {
    route: '/portal/volunteer',
    label: 'Volunteer',
    items: [
      {
        q: 'How do I sign up to serve?',
        a: 'Go to Volunteer, browse the open shifts, find one that works, and click Sign up. You\'re added to the roster instantly.',
      },
      {
        q: 'How do I cancel a shift I signed up for?',
        a: "Find the shift in \"My shifts\" and click Cancel. You'll be removed right away. If it's close to the date, consider letting your ministry leader know directly.",
      },
      {
        q: "What's the difference between Roles and Shifts?",
        a: 'Roles are the types of service positions (e.g. "Greeter", "Sound team"). Shifts are the specific scheduled times for each role. You sign up for a shift.',
      },
      {
        q: 'How do I tell the church when I\'m generally available?',
        a: 'Go to the Availability section. Choose a day, set your free time window, add a note if needed, and click Save. Add as many windows as you like.',
      },
    ],
  },
  {
    route: '/portal/notifications',
    label: 'Notifications',
    items: [
      {
        q: 'How do I mark a notification as read?',
        a: 'Click Mark read next to the notification. Read notifications stay in your list but appear faded.',
      },
      {
        q: 'How do I stop getting emails or texts?',
        a: 'Go to Notifications → preferences and toggle off whichever channel you want to stop: Email, SMS, WhatsApp, In-App, or Push.',
      },
      {
        q: 'Can I set quiet hours so I don\'t get messages at night?',
        a: 'Yes. In notification preferences, turn on Quiet hours for any channel and set your start and end time. Messages sent during that window are held and delivered after.',
      },
    ],
  },
  {
    route: '/portal/surveys',
    label: 'Surveys',
    items: [
      {
        q: 'How do I submit a survey?',
        a: 'Answer each question (required ones are marked *). Once all required questions are answered, the Submit button activates. Click Submit survey.',
      },
      {
        q: 'What types of questions will I see?',
        a: 'Text — type your answer. Rating — enter 1 to 5. Multiple choice — tick all that apply. Single choice — pick one from the dropdown.',
      },
      {
        q: "I don't see any surveys.",
        a: 'Surveys only appear when your church has published an active one. Check back later or ask your admin if you\'re expecting one.',
      },
    ],
  },
];

/** Returns the section that matches the current pathname, plus the general "Getting started" section. */
export function getHelpForRoute(pathname: string): HelpSection[] {
  const matched = helpSections.find((s) => s.route === pathname);
  const general = helpSections.find((s) => s.route === '/portal')!;
  if (!matched || matched.route === '/portal') return [general];
  return [matched, general];
}

/** Flat search across all help items. */
export function searchHelp(query: string): HelpItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: HelpItem[] = [];
  for (const section of helpSections) {
    for (const item of section.items) {
      if (item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)) {
        results.push(item);
      }
    }
  }
  return results;
}
