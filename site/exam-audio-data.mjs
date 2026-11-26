export const listeningGroups = [
  { title: '长对话 1', first: 1, last: 4 },
  { title: '长对话 2', first: 5, last: 8 },
  { title: '短文 1', first: 9, last: 11 },
  { title: '短文 2', first: 12, last: 15 },
  { title: '讲座 1', first: 16, last: 18 },
  { title: '讲座 2', first: 19, last: 21 },
  { title: '讲座 3', first: 22, last: 25 },
];

// SHA-256 and byte counts refer to the playback file. When the playback encode
// differs from the primary archive, archive retains the metadata from meta.json.
// Segment bounds are in seconds on that playback file, in listeningGroups order.
// The June 2024 source editions use the opposite set numbers from our PDF.
export const examAudio = {
  "2022-06-1": {
    "url": "https://testingcf.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2022-06/01/listen.m4a",
    "fallbackUrl": "https://gcore.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2022-06/01/listen.m4a",
    "originalUrl": "https://raw.githubusercontent.com/1e5e11/CET46-Resources/main/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2022.06/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/2022%E5%B9%B406%E6%9C%88%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98%EF%BC%88%E5%85%A81%E5%A5%97%EF%BC%89.mp3",
    "sourceUrl": "https://github.com/Aron0525/English-past-papers/blob/3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2022-06/01/meta.json",
    "bytes": 13944033,
    "segments": [[55.2, 276.7], [277.5, 494.9], [527.9, 724.8], [725.6, 933.1], [965, 1209.8], [1210.6, 1461.7], [1462.6, 1717.9]],
    "sha256": "baf049101a22b4b7077ad0a76c0e0145e4cea2aae9033378ee9da107eb13e1e2"
  },
  "2022-09-1": {
    "url": "https://testingcf.jsdelivr.net/gh/1e5e11/CET46-Resources@a5c0db497d927eab73e901df43b70562fb65a294/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2022.09/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2022_09_1.m4a",
    "fallbackUrl": "https://46.ssssssss.eu.org/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2022.09/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2022_09_1.m4a",
    "originalUrl": "https://raw.githubusercontent.com/1e5e11/CET46-Resources/main/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2022.09/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2022_09_1.m4a",
    "sourceUrl": "https://github.com/1e5e11/CET46-Resources/blob/a5c0db497d927eab73e901df43b70562fb65a294/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2022.09/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2022_09_1.m4a",
    "bytes": 4836220,
    "segments": [[38, 240.3], [241.1, 446.1], [476.8, 665], [665.8, 869.2], [897.9, 1143.3], [1144.1, 1377.4], [1378.3, 1637.1]],
    "sha256": "abeb24db02d8b325504de83750636b9f8775e0a27a4fc3da7e85b2710d9fe29c"
  },
  "2022-12-1": {
    "url": "https://testingcf.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2022-12/01/listen.m4a",
    "fallbackUrl": "https://gcore.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2022-12/01/listen.m4a",
    "originalUrl": "https://raw.githubusercontent.com/1e5e11/CET46-Resources/main/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2022.12/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/2022.12%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98%E7%AC%AC1%E5%A5%97%E5%90%AC%E5%8A%9B.mp3",
    "sourceUrl": "https://github.com/Aron0525/English-past-papers/blob/3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2022-12/01/meta.json",
    "bytes": 19911175,
    "segments": [[33.9, 227.9], [228.8, 432.8], [461.3, 647.1], [647.9, 852.6], [879.4, 1144.5], [1145.4, 1364], [1364.9, 1631.3]],
    "sha256": "3c44ab29e498f31d6fd3fe4161b100b95d4aefbe1058ec746caec61adf2f2fda"
  },
  "2022-12-2": {
    "url": "https://testingcf.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2022-12/02/listen.m4a",
    "fallbackUrl": "https://gcore.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2022-12/02/listen.m4a",
    "originalUrl": "https://raw.githubusercontent.com/1e5e11/CET46-Resources/main/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2022.12/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/2022.12%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98%E7%AC%AC2%E5%A5%97%E5%90%AC%E5%8A%9B.mp3",
    "sourceUrl": "https://github.com/Aron0525/English-past-papers/blob/3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2022-12/02/meta.json",
    "bytes": 19307494,
    "segments": [[33.8, 240.9], [241.8, 432], [460.2, 633.9], [634.8, 839.9], [866.5, 1099.1], [1100, 1339.4], [1340.3, 1581.7]],
    "sha256": "765025e97ae8a0860713a27b1504394d738722a11ee0e891ea9ccc02a1e07a5a"
  },
  "2023-06-1": {
    "url": "https://testingcf.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2023-06/01/listen.m4a",
    "fallbackUrl": "https://gcore.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2023-06/01/listen.m4a",
    "originalUrl": "https://raw.githubusercontent.com/1e5e11/CET46-Resources/main/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2023.06/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/2023.06%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98%E7%AC%AC1%E5%A5%97%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91.mp3",
    "sourceUrl": "https://github.com/Aron0525/English-past-papers/blob/3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2023-06/01/meta.json",
    "bytes": 20119016,
    "segments": [[34.6, 232.6], [233.4, 444.7], [472.7, 652.0], [652.8, 884.0], [911.3, 1147.8], [1148.5, 1391.4], [1392.2, 1647.8]],
    "sha256": "2cf3e68b98488d9f091bbf27aea208ee5567e2c0cbc8e2af0aae2d2e23b6dd48"
  },
  "2023-06-2": {
    "url": "https://testingcf.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2023-06/02/listen.m4a",
    "fallbackUrl": "https://gcore.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2023-06/02/listen.m4a",
    "originalUrl": "https://raw.githubusercontent.com/1e5e11/CET46-Resources/main/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2023.06/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/2023.06%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98%E7%AC%AC2%E5%A5%97%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91.mp3",
    "sourceUrl": "https://github.com/Aron0525/English-past-papers/blob/3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2023-06/02/meta.json",
    "bytes": 20119815,
    "segments": [[34.6, 230.4], [231.2, 426.8], [454.6, 631.2], [632, 844.6], [871.8, 1136.3], [1137.1, 1382.9], [1383.8, 1648.5]],
    "sha256": "ec04e996cc9f92d13f6803fdc5c236f5c81402b5524ba301f0ca595df8e05b9c"
  },
  "2024-06-1": {
    "url": "https://testingcf.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2024-06/02/listen.m4a",
    "fallbackUrl": "https://46.ssssssss.eu.org/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2024.06/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2024_06_2.m4a",
    "originalUrl": "https://raw.githubusercontent.com/1e5e11/CET46-Resources/main/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2024.06/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2024_06_2.m4a",
    "sourceUrl": "https://github.com/Aron0525/English-past-papers/blob/3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2024-06/02/meta.json",
    "bytes": 4561348,
    "segments": [[34.6, 224.7], [225.6, 426.1], [458.4, 628], [628.9, 812.7], [838, 1064], [1064.9, 1291.9], [1292.8, 1545.1]],
    "sha256": "fac9987f4ecb6ba750134dcb05e6553b8b8afb6d9da8febd3c31cdf0a435b74c"
  },
  "2024-06-2": {
    "url": "https://testingcf.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2024-06/01/listen.m4a",
    "fallbackUrl": "https://46.ssssssss.eu.org/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2024.06/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2024_06_1.m4a",
    "originalUrl": "https://raw.githubusercontent.com/1e5e11/CET46-Resources/main/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2024.06/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2024_06_1.m4a",
    "sourceUrl": "https://github.com/Aron0525/English-past-papers/blob/3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2024-06/01/meta.json",
    "bytes": 4771487,
    "segments": [[34.6, 221.5], [222.4, 425.4], [457.7, 652.9], [653.7, 855.7], [881, 1116.4], [1117.2, 1356.9], [1357.8, 1615.5]],
    "sha256": "98f87cce756cf13824d13b3014b9d62294327d7d3d2784f01b8ba83483b73517"
  },
  "2024-12-1": {
    "url": "https://testingcf.jsdelivr.net/gh/1e5e11/CET46-Resources@a5c0db497d927eab73e901df43b70562fb65a294/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2024.12/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2024_12_1.m4a",
    "fallbackUrl": "https://46.ssssssss.eu.org/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2024.12/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2024_12_1.m4a",
    "originalUrl": "https://raw.githubusercontent.com/1e5e11/CET46-Resources/main/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2024.12/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/2024%E5%B9%B412%E6%9C%88%E5%85%AD%E7%BA%A7%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91%E7%AC%AC1%E5%A5%97.mp3",
    "sourceUrl": "https://github.com/Aron0525/English-past-papers/blob/3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2024-12/01/meta.json",
    "bytes": 4906476,
    "segments": [[35, 247.2], [248, 447.3], [474.9, 640.2], [641, 853.3], [881.4, 1141.2], [1142, 1364.7], [1365.6, 1661.1]],
    "sha256": "c2b4564130553a8856aff78bef55a0a26449ce40dbdcc3638114771bccac6e36",
    "archive": {
      "bytes": 70863497,
      "sha256": "fc55a9951fae6b300a077197f0ca403b7fd2f60dd3dbb7eeb0b212af07a29660"
    }
  },
  "2024-12-2": {
    "url": "https://testingcf.jsdelivr.net/gh/1e5e11/CET46-Resources@a5c0db497d927eab73e901df43b70562fb65a294/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2024.12/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2024_12_2.m4a",
    "fallbackUrl": "https://46.ssssssss.eu.org/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2024.12/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2024_12_2.m4a",
    "originalUrl": "https://raw.githubusercontent.com/1e5e11/CET46-Resources/main/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2024.12/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/2024%E5%B9%B412%E6%9C%88%E5%85%AD%E7%BA%A7%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91%E7%AC%AC2%E5%A5%97.mp3",
    "sourceUrl": "https://github.com/Aron0525/English-past-papers/blob/3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2024-12/02/meta.json",
    "bytes": 4830413,
    "segments": [[34.8, 229], [229.9, 429.5], [457.2, 654.5], [655.4, 867.9], [895.9, 1131.7], [1132.6, 1378.1], [1378.9, 1635.3]],
    "sha256": "404b8a20d3881ad478e88c62cd9434989182c8c3e45cc8277aab3a3f07a0431b",
    "archive": {
      "bytes": 27895942,
      "sha256": "a1e3b6fc1f5fd2c7cd5dc33cc76d1a222bd896048d537c1f7169b7e333f3d8ad"
    }
  },
  "2025-06-1": {
    "url": "https://testingcf.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2025-06/01/listen.m4a",
    "fallbackUrl": "https://46.ssssssss.eu.org/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2025.06/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2025_06_1.m4a",
    "originalUrl": "https://raw.githubusercontent.com/1e5e11/CET46-Resources/main/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2025.06/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2025_06_1.m4a",
    "sourceUrl": "https://github.com/Aron0525/English-past-papers/blob/3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2025-06/01/meta.json",
    "bytes": 4587324,
    "segments": [[38.8, 222.3], [223.2, 419.4], [449.7, 627.4], [628.3, 818.9], [846.1, 1088.7], [1089.6, 1307.9], [1308.7, 1553.4]],
    "sha256": "90906779576f8a32d14030d3d394a7bea33322c276c9701728173aff36912703"
  },
  "2025-06-2": {
    "url": "https://testingcf.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2025-06/02/listen.m4a",
    "fallbackUrl": "https://46.ssssssss.eu.org/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2025.06/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2025_06_2.m4a",
    "originalUrl": "https://raw.githubusercontent.com/1e5e11/CET46-Resources/main/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2025.06/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2025_06_2.m4a",
    "sourceUrl": "https://github.com/Aron0525/English-past-papers/blob/3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2025-06/02/meta.json",
    "bytes": 4616581,
    "segments": [[38.4, 235.4], [236.3, 432.9], [463, 651], [651.8, 844.8], [872, 1083.4], [1084.3, 1316], [1316.9, 1562.1]],
    "sha256": "eb99adfdf23c1b7f8ad93d7c30be8d354f104801760c318b9d352ff984fe4196"
  },
  "2025-12-1": {
    "url": "https://testingcf.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2025-12/01/listen.mp3",
    "fallbackUrl": "https://gcore.jsdelivr.net/gh/Aron0525/English-past-papers@3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2025-12/01/listen.mp3",
    "originalUrl": "https://raw.githubusercontent.com/1e5e11/CET46-Resources/main/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2025.12/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/2025%E5%B9%B412%E6%9C%88%E5%85%AD%E7%BA%A7%E5%90%AC%E5%8A%9B%E7%AC%AC1%E5%A5%97.mp3",
    "sourceUrl": "https://github.com/Aron0525/English-past-papers/blob/3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2025-12/01/meta.json",
    "bytes": 12345722,
    "segments": [[35.7, 234], [234.8, 419.8], [450.1, 610.7], [611.5, 808.6], [834.2, 1052.6], [1053.5, 1295.4], [1296.2, 1538.9]],
    "sha256": "7aafd6237549cb8719d41dc0c88614210bed6c86c4a0cc0f8bfe8db8f4b921bb"
  },
  "2025-12-2": {
    "url": "https://gcore.jsdelivr.net/gh/1e5e11/CET46-Resources@a5c0db497d927eab73e901df43b70562fb65a294/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2025.12/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2025_12_2.m4a",
    "fallbackUrl": "https://46.ssssssss.eu.org/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2025.12/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/cet6_2025_12_2.m4a",
    "originalUrl": "https://raw.githubusercontent.com/1e5e11/CET46-Resources/main/%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98/2025.12/%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91/2025%E5%B9%B412%E6%9C%88%E5%85%AD%E7%BA%A7%E5%90%AC%E5%8A%9B%E7%AC%AC2%E5%A5%97.mp3",
    "sourceUrl": "https://github.com/Aron0525/English-past-papers/blob/3d9a092848106834a079c6bac322510bfdc4e234/zhenti-local/data/cet6/2025-12/02/meta.json",
    "bytes": 4579121,
    "segments": [[36.4, 230.6], [231.5, 429.5], [459.8, 640.6], [641.4, 834.1], [859.8, 1087.8], [1088.7, 1323.8], [1324.6, 1550.9]],
    "sha256": "a3b51d42450edaee5d85d6e997251f4c1300b645d0f71529bd103c8c1a5fc2d7",
    "archive": {
      "bytes": 25163452,
      "sha256": "902d5075868b33864cbbd3113ac1c4f4ee443d77b4886eee11792085f466de95"
    }
  }
};
