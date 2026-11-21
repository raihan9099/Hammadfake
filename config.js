// config.js
module.exports = {
  profile: {
    name: 'Hammad Bin Amir',
    username: '@baiillamaach_official',
    bio: 'Official Entertainment Profile · Verified Creator',
    avatar: '/assets/celebrity_pfp.jpeg'
  },

  stats: {
    tiktokFollowers: '7K',
    tiktokLikes: '190K',
    following: '0',
    facebookFollowers: '2.5K'
  },

  links: {
    tiktok: 'https://tiktok.com/@baiillamaach_official',
    facebook: 'https://www.facebook.com/profile.php?id=61575202118828',
    instagram: '',
    youtube: ''
  },

  fakeAccounts: [
    {
      username: '@baiilla_mach',
      platform: 'TikTok',
      url: 'https://tiktok.com/@baiilla_mach',
      reason: 'Copies official content to deceive followers.',
      image: '/assets/baillamach_fake.png'
    },
    {
      username: '@hammad_fams0',
      platform: 'TikTok',
      url: 'https://tiktok.com/@hammad_fams0',
      reason: 'Impersonating with fake content.',
      image: '/assets/hammadfams.png'
    }
  ],

  assets: {
    profile: '/assets/celebrity_pfp.jpeg',
    fbProfile: '/assets/fb_profile.jpg',
    blueTikTok: '/assets/bluetick_tiktok.png',
    blueFB: '/assets/blue_tick_fb.png',
    logoFB: '/assets/logo_fb.png',
    logoTikTok: '/assets/logo_tiktok.png',
    messageBubble: '/assets/message_bubble.gif',
    microphone: '/assets/microphone-in-hand.gif',
    reportBtn: '/assets/report_button.png',
    realId: '/assets/real-id-ss.png',
    fakeDetect: '/assets/Fakedetect_updown.png',
    baillamachFake: '/assets/baillamach_fake.png',
    hammadFake: '/assets/hammadfams.png',
    followGif: '/assets/follow.gif',
    propagandaGif: '/assets/propaganda.gif',
    addGif: '/assets/add.gif',
    reportGif: '/assets/report.gif',
    playGif: '/assets/play.gif'
  },

  voice: {
    welcome: 'assets/realvoice.mp3',
    manualAlert: 'assets/manualvoice_alert.mp3'
  },

  musicDir: 'assets/covermusic',

  admin: {
    defaultEmail: 'admin',
    defaultPassword: 'admin123'
  },

  server: {
    port: process.env.PORT || 4000,
    mongoUri: process.env.MONGO_URI || 'mongodb+srv://Milowitz_ok_fine1100:IJ5oodf0RHxM9H4S@cluster0.ns0lcvd.mongodb.net/verification_hub?retryWrites=true&w=majority',
    sessionSecret: 'baiilla-maach-secret-key'
  }
};
