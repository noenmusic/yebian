export interface Note { id: string; number: string; title: string; text: string; reply: string; tags: string[]; words: string[]; portrait: number }
// 预置的演示纸条：全部为 Demo 数据，不代表真实用户互动（README 有说明）。
export const NOTES: Note[] = [
  { id: 'exam', number: '0042', title: '再翻一次，也没有关系', text: '二战考研的第一天，又坐回了熟悉的书桌。今天不想证明什么，先把这一页看完。', reply: '不必急着给这段日子一个结论。今天读完的一页，也算数。', tags: ['重新备考', '慢慢来'], words: ['考研', '二战', '备考', '考试', '复习', '上岸'], portrait: 0 },
  { id: 'city', number: '0117', title: '慢慢认得这座城', text: '搬来新的城市两周了。今天发现楼下的早餐店，会记得我不放香菜。好像有一点点安定了。', reply: '愿你在陌生的街道，也能慢慢找到一盏熟悉的灯。', tags: ['异乡生活', '小小安定'], words: ['异乡', '城市', '搬家', '陌生', '租房', '家乡', '想家'], portrait: 1 },
  { id: 'work', number: '0206', title: '在下一站之前', text: '投出的简历还没有回音。傍晚去走了走，回来把窗台擦干净。等待的时候，也想好好生活。', reply: '等待不等于停住。也可以先把今天过得松一点。', tags: ['求职途中', '等待回音'], words: ['工作', '求职', '简历', '面试', '失业', '毕业'], portrait: 2 },
  { id: 'night', number: '0089', title: '今晚先放下这一页', text: '最近总是很晚才睡。今晚决定不把所有问题想明白，关掉一盏灯，给明天留一点空白。', reply: '没想完的事情，明天仍然可以接着想。今晚不必交出答案。', tags: ['夜晚心事', '留点空白'], words: ['失眠', '睡不着', '熬夜', '深夜', '晚上', '晚睡'], portrait: 3 },
  { id: 'walk', number: '0315', title: '走一段没有目的的路', text: '下班后绕了远路。没听播客，也没算步数，只看见树影一点点变长。原来这样就很好。', reply: '这张纸条没有任务。只是想和你分享一小段散步的时间。', tags: ['出门走走', '日常缝隙'], words: ['散步', '走走', '下班', '公园', '树', '步行'], portrait: 4 },
  { id: 'create', number: '0163', title: '画歪的线也留下', text: '重新捡起画笔，第一张画得乱七八糟。没有撕掉，夹进本子里。想把“开始过”也留下来。', reply: '第一笔不用漂亮。给还不熟练的自己，留一点位置。', tags: ['重新开始', '随手创作'], words: ['画画', '画笔', '创作', '写作', '画', '手工'], portrait: 5 },
  { id: 'social', number: '0258', title: '安静也可以在场', text: '聚会时没说多少话，回家却记得每个人的笑声。也许安静地坐在那里，就是我的参与方式。', reply: '不用变得很热闹，才值得被认真听见。', tags: ['安静的人', '自己的节奏'], words: ['孤独', '一个人', '朋友', '不合群', '社交', '聚会'], portrait: 6 },
  { id: 'rest', number: '0371', title: '今天，允许慢一点', text: '待办清单只划掉了一项，但我认真吃了午饭。把这件小事写下来，今天也不是空白的一天。', reply: '这不是一张催促你的纸条。休息也可以是今天重要的一件事。', tags: ['有点疲惫', '照顾自己'], words: ['累', '疲惫', '休息', '压力', '焦虑', '忙'], portrait: 7 },
  { id: 'grad', number: '0521', title: '第三章，先写一行也行', text: '论文卡在第三章三天了。今天不追求完整，只写一段能看的话。', reply: '先写出一句不漂亮的话，就已经不算空白。', tags: ['毕业路上', '先动笔'], words: ['论文', '毕业论文', '毕业设计', '毕设', '初稿', '开题', '答辩'], portrait: 0 },
  { id: 'heartbreak', number: '0633', title: '难过的时候，先照顾一下自己', text: '分手三个月，今天路过那家店还是走了进去。原来我还记得，也还好。', reply: '不必急着“好起来”。能好好吃一顿饭的日子，都在慢慢算数。', tags: ['慢慢愈合', '照顾自己'], words: ['失恋', '分手', '前任', '走出来', '放下', '难过'], portrait: 1 },
  { id: 'cet', number: '0748', title: '425 不是天堑', text: '四级考了三次，每次都差几分。今晚决定先背二十个单词，不去想结果。', reply: '那几分的距离，走得到。今晚的二十个单词，就是证据。', tags: ['再试一次', '慢慢积累'], words: ['四级', '六级', '四六级', '英语', '单词', '挂科'], portrait: 2 },
  { id: 'ldr', number: '0814', title: '距离很远，视频很近', text: '异地第三年。今晚视频时她先睡着了，我把手机放在枕边，听了十分钟呼吸声。', reply: '有一些陪伴，隔着屏幕也算数。', tags: ['异地恋', '隔空陪伴'], words: ['异地恋', '异地', '距离', '视频', '见面', '想念'], portrait: 3 },
  { id: 'parttime', number: '0902', title: '赚第一笔自己的钱', text: '第一次做家教回来，赚了六十块。没有马上花掉，在公交上数了三遍。', reply: '靠自己的双手换来的第一笔钱，怎么数都值得高兴。', tags: ['第一份兼职', '慢慢独立'], words: ['兼职', '家教', '赚钱', '打工', '实习', '零花钱'], portrait: 4 },
  { id: 'major', number: '1036', title: '不喜欢，也可以先读完这一页', text: '专业课听不进去，在草稿纸边画了四十个圈。先把手头的这一科考完吧。', reply: '不喜欢不等于走错了路。先把眼前这一页读完，再决定往哪转。', tags: ['选错专业', '先完成眼前'], words: ['专业', '转专业', '选错', '课程', '迷茫', '不喜欢'], portrait: 5 },
  { id: 'fitness', number: '1147', title: '跑不动的日子，也出门', text: '今天只跑了八百米就走不动了。没关系，我换成了快走，把这一公里走完了。', reply: '跑步这件事，出门本身就已经赢了一半。', tags: ['坚持运动', '不苛求'], words: ['跑步', '健身', '运动', '锻炼', '减肥', '晨跑', '夜跑'], portrait: 6 },
  { id: 'pet', number: '1259', title: '你走了以后，我把碗收起来了', text: '猫走了两周。今天第一次把它的饭盆洗干净收进柜子，没有哭。', reply: '它来过这件事，不会被收起来。', tags: ['想念小猫', '慢慢告别'], words: ['宠物', '猫', '猫咪', '狗', '小狗', '去世', '告别'], portrait: 0 },
  { id: 'interview', number: '1368', title: '面试前，先和自己聊三分钟', text: '明天第一次群面，晚上对着镜子自我介绍，讲到第三遍才不结巴。', reply: '面试官想听的是你，不是完美的你。第三遍的你，已经可以了。', tags: ['求职面试', '临阵练习'], words: ['面试', '紧张', '群面', 'offer', '自我介绍', '秋招'], portrait: 1 },
  { id: 'cook', number: '1479', title: '一个人，也好好吃饭', text: '今天给自己炒了一盘青菜和一份蛋炒饭，吃完把锅洗了。一个人吃饭也可以认真。', reply: '认真对待一餐一饭，是独居里最温柔的抵抗。', tags: ['一人食', '认真生活'], words: ['做饭', '吃饭', '一个人', '厨房', '独居', '做菜', '外卖'], portrait: 2 },
];
// AI 邮差预生成的同频理由：2026-09-15 用 claude-sonnet-5（api.openai-next.com 黑客松 token）按纸条主题批量生成一次后固化进源码，运行时不做实时调用；展示时与「文字交集」提示连用。
export const AI_REASONS: Record<string, string> = {
  exam: '也许有人也在二战考研，此刻也想先把这一页安心看完。',
  city: '可能也有人刚到新城市，也在慢慢找一盏熟悉的灯。',
  work: '也许有人也在等回音，同样想把等待的日子过得松一点。',
  night: '可能也有人今晚不想全想明白，只想留一点空白入睡。',
  walk: '也许有人也爱绕远路，只想安静看一看树影变长。',
  create: '可能也有人重新拿起画笔，愿意留下不完美的开始。',
  social: '也许有人也在聚会里安静着，却把笑声都记在心里。',
  rest: '可能也有人今天进度不多，但也认真吃了一顿午饭。',
  grad: '也许有人论文也卡住了，今天只想写出一段能看的话。',
  heartbreak: '可能也有人慢慢走出分手的日子，还好也能算数。',
  cet: '也许有人也在为几分努力，今晚也想先背完二十个单词。',
  ldr: '可能也有人也在异地，隔着屏幕听一段安心的呼吸声。',
  parttime: '也许有人也数过第一笔自己赚的钱，笑着数了好几遍。',
  major: '可能也有人也不喜欢本专业，仍想先读完眼前这一页。',
  fitness: '也许有人也跑跑走走，觉得出门本身已经很棒了。',
  pet: '可能也有人也在慢慢收拾思念，它来过这件事都记得。',
  interview: '也许有人也在对镜子练习，讲到不结巴才安心一点。',
  cook: '可能也有人也在为自己认真做一顿饭，一个人也用心。',
};
export const PRESETS = ['考研二战，想再给自己一次机会。', '来到新城市，有一点想家。', '今天有点累，想慢一点。'];
export interface Reference { title: string; author: string; excerpt: string; url: string; votes: number; cachedOn: string; source: string }
// 引用卡：每条纸条对应一条真实知乎公开内容，经 zhihu-cli search 预取（缓存于 桌面/页边-知乎引用缓存/）。
// 摘要均为从缓存原文中截取的连续片段，不做改写；作者/链接/赞数保留原值。
export const REFERENCE_MAP: Record<string, Reference> = {
  exam: { title: '决定考研二战前应该作什么准备?', author: '百里推冰', excerpt: '投入学习的一小时可以抵得上你流于形式复习的三小时，所以复习效率也是你复盘时需要注意的一点。', url: 'https://www.zhihu.com/question/518410812/answer/2362521730?utm_medium=openapi_platform&utm_source=cf621feb3f2d', votes: 44, cachedOn: '2026-09-13', source: '知乎开放平台搜索缓存' },
  grad: { title: '写论文初稿,一直写不下去陷入内耗,如何破局?', author: '小艾学长说论文', excerpt: '脑子里有一个“理想初稿”的样子，觉得写出来必须逻辑严密、措辞精准、论证完整', url: 'https://zhuanlan.zhihu.com/p/2081832803478652691?utm_medium=openapi_platform&utm_source=cf621feb3f2d', votes: 1, cachedOn: '2026-09-15', source: '知乎开放平台搜索缓存' },
  heartbreak: { title: '分手后情绪反复:让你真正走出来的不是时间,而是做好这件事', author: 'KnowYourself', excerpt: '关系结束真正让人痛苦的，往往不是“分手”的那一刻，而是你明明想向前走，却一次次被拖回原地', url: 'https://zhuanlan.zhihu.com/p/2074926618691356401?utm_medium=openapi_platform&utm_source=cf621feb3f2d', votes: 8, cachedOn: '2026-09-15', source: '知乎开放平台搜索缓存' },
  cet: { title: '四六级考了好几次都没过,是不是真的该放弃了?', author: '知乎用户', excerpt: '后来想明白了：四级 425 那条线，对应的词汇量和阅读能力，差不多就是“高中英语学得还行”的水平', url: 'https://www.zhihu.com/question/2073818691419087136/answer/2078456807400522010?utm_medium=openapi_platform&utm_source=cf621feb3f2d', votes: 1, cachedOn: '2026-09-15', source: '知乎开放平台搜索缓存' },
  ldr: { title: '放不下的异地恋,问题真的只是“分不分手”吗?', author: 'KnowYourself', excerpt: '一开始，我们都相信一句话：只要感情在，距离不是问题', url: 'https://zhuanlan.zhihu.com/p/2040552584046434256?utm_medium=openapi_platform&utm_source=cf621feb3f2d', votes: 1, cachedOn: '2026-09-15', source: '知乎开放平台搜索缓存' },
  parttime: { title: '普通大学生可以做点什么兼职赚钱?', author: '知乎用户', excerpt: '我更建议大家，先从自己已经有一点基础、也愿意继续了解的事情里找机会', url: 'https://www.zhihu.com/question/314142047/answer/2081016104005145585?utm_medium=openapi_platform&utm_source=cf621feb3f2d', votes: 123, cachedOn: '2026-09-15', source: '知乎开放平台搜索缓存' },
  major: { title: '如果大学专业选错了,我该如何有效补救或转行?', author: '球球怪', excerpt: '大二，专业课刚开，发现自己每天走进教室就像上刑场', url: 'https://www.zhihu.com/question/2053796743762932312/answer/2055044869337489723?utm_medium=openapi_platform&utm_source=cf621feb3f2d', votes: 16, cachedOn: '2026-09-15', source: '知乎开放平台搜索缓存' },
  fitness: { title: '跑步那么苦,坚持的意义是什么?', author: '竹子', excerpt: '我跑步8年多，累积跑量25000+km，有记录的连续跑步是428周。我其实不太喜欢“坚持”这个词', url: 'https://www.zhihu.com/question/2052761697375540538/answer/2058968891146121793?utm_medium=openapi_platform&utm_source=cf621feb3f2d', votes: 32, cachedOn: '2026-09-15', source: '知乎开放平台搜索缓存' },
  pet: { title: '猫咪去世后你是怎么走出来的?', author: '小蚂蚁', excerpt: '2019年我从公园把你抱走的，今天我再把你从医院抱回家', url: 'https://www.zhihu.com/question/569924182/answer/1936976609950303132?utm_medium=openapi_platform&utm_source=cf621feb3f2d', votes: 28, cachedOn: '2026-09-15', source: '知乎开放平台搜索缓存' },
  interview: { title: '学生在求职面试时过于紧张,导致发挥失常,有哪些方法可以有效缓解?', author: '唐安妮', excerpt: '面试紧张、发挥失常，绝大多数时候不是你能力不行，而是你对面试的认知、临场心态调节方式出了问题', url: 'https://www.zhihu.com/question/2043286776211576038/answer/2043368836439732375?utm_medium=openapi_platform&utm_source=cf621feb3f2d', votes: 2, cachedOn: '2026-09-15', source: '知乎开放平台搜索缓存' },
  cook: { title: '自己一个人吃饭,你会做什么?', author: '自由如风', excerpt: '近两年，大部分时间都是一个人吃饭，一个人也尽量每天做新鲜的菜饭', url: 'https://www.zhihu.com/question/280283392/answer/2019201725228134787?utm_medium=openapi_platform&utm_source=cf621feb3f2d', votes: 117, cachedOn: '2026-09-15', source: '知乎开放平台搜索缓存' },
};
// 兼容旧引用（旧测试与首页引用断言仍指向这条）
export const REFERENCE = REFERENCE_MAP.exam;
