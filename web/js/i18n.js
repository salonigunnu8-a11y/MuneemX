/* =========================================================
   MuneemX — English / हिन्दी
   Screens are written in English. When Hindi is on, every piece of UI text
   on the page is swapped for its Hindi version as it appears (labels,
   buttons, placeholders, toasts). Brand names, product names, numbers and
   shop data are left untouched. Add a line to HI to translate more text.
   ========================================================= */
'use strict';
const LANG = { cur: (() => { try { return localStorage.getItem('mx_lang') || 'en'; } catch (e) { return 'en'; } })() };

const HI = {
  // ---- navigation & shell ----
  'Dashboard': 'डैशबोर्ड', 'Scan & Sell': 'स्कैन करके बेचें', 'Bills': 'बिल', 'Inventory': 'स्टॉक', 'Expenses': 'खर्च',
  'Staff & Salary': 'स्टाफ़ और वेतन', 'Reports': 'रिपोर्ट', 'Settings': 'सेटिंग्स', 'Sign out': 'लॉग आउट', 'Clients': 'क्लाइंट',
  'Growth roadmap': 'विकास योजना', 'Powered by': 'संचालित', 'Powered by MuneemX': 'MuneemX द्वारा संचालित', 'Platform console': 'प्लेटफ़ॉर्म कंसोल',
  'Live': 'लाइव', 'Live demo on': 'लाइव डेमो चालू', 'Live demo off': 'लाइव डेमो बंद', 'Generates demo sales every few seconds': 'हर कुछ सेकंड में डेमो बिक्री बनाता है',
  'Exit workspace': 'वर्कस्पेस से बाहर', 'owner': 'मालिक', 'manager': 'मैनेजर', 'salesman': 'सेल्समैन', 'superadmin': 'सुपर एडमिन',
  'Demo mode — sample data in this browser. Connect Supabase to go live.': 'डेमो मोड — नमूना डेटा इसी ब्राउज़र में है। लाइव करने के लिए Supabase जोड़ें।',
  'Demo mode · data stays in this browser': 'डेमो मोड · डेटा इसी ब्राउज़र में रहता है',
  'Light': 'लाइट', 'Dark': 'डार्क', 'Light mode': 'लाइट मोड', 'Dark mode': 'डार्क मोड', 'Language': 'भाषा',
  'Barcode scanner test': 'बारकोड स्कैनर जाँच', 'Click here, then scan': 'यहाँ क्लिक करें, फिर स्कैन करें',
  'Click the box and scan any bottle. It shows what your USB / Bluetooth scanner sends and whether it is set up correctly.': 'बॉक्स पर क्लिक करके कोई भी बोतल स्कैन करें। यह दिखाएगा कि आपका USB / Bluetooth स्कैनर क्या भेज रहा है और सही सेट है या नहीं।',
  'Received': 'मिला', 'characters': 'अक्षर', 'Scanner detected': 'स्कैनर पहचाना गया', 'Typed slowly — looks like a keyboard, not a scanner': 'धीरे टाइप हुआ — स्कैनर नहीं, कीबोर्ड लगता है',
  'Ends with Enter — perfect': 'अंत में Enter — बिल्कुल सही', 'No Enter at the end — still works, but set the scanner suffix to Enter (CR) for speed': 'अंत में Enter नहीं — फिर भी चलेगा, पर तेज़ी के लिए स्कैनर का suffix Enter (CR) सेट करें',
  'Not in your database yet — link it in Inventory → Link barcodes': 'अभी डेटाबेस में नहीं — स्टॉक → बारकोड जोड़ें में जोड़ें',
  // ---- discount, customer, udhar, WhatsApp ----
  'Mobile': 'मोबाइल', 'Udhar': 'उधार', 'Udhar (Credit)': 'उधार (क्रेडिट)', 'Discount': 'छूट', '(optional)': '(वैकल्पिक)', 'off': 'छूट', 'Customer': 'ग्राहक', 'Hide': 'छिपाएँ',
  'Required for Udhar': 'उधार के लिए ज़रूरी', 'Add customer name & mobile': 'ग्राहक का नाम और मोबाइल जोड़ें', 'Customer name': 'ग्राहक का नाम', 'Mobile number': 'मोबाइल नंबर',
  "Full bill amount goes to the customer's udhar (credit). It shows under Udhar until it is paid.": 'पूरी बिल राशि ग्राहक के उधार में जाएगी। भुगतान होने तक यह उधार में दिखेगी।',
  'Lock as Udhar': 'उधार में लॉक करें', 'Confirm & lock bill': 'कन्फ़र्म करें और बिल लॉक करें', 'Discount must be less than the bill total': 'छूट बिल कुल से कम होनी चाहिए',
  'Cash received is less than the total': 'मिला नकद कुल से कम है', 'Tick “Payment received on phone”': '“फ़ोन पर भुगतान मिल गया” पर टिक करें',
  'Udhar needs the customer name and a 10-digit mobile number': 'उधार के लिए ग्राहक का नाम और 10 अंकों का मोबाइल नंबर ज़रूरी है',
  'WhatsApp bill': 'WhatsApp पर बिल', 'Enter a 10-digit mobile number': '10 अंकों का मोबाइल नंबर डालें', 'Subtotal': 'उप-कुल',
  'Udhar pending': 'बाकी उधार', 'Udhar (credit) pending': 'बाकी उधार (क्रेडिट)', 'customers': 'ग्राहक', 'Udhar given this month': 'इस महीने दिया उधार', 'Collected this month': 'इस महीने वसूला',
  'Oldest unpaid bill': 'सबसे पुराना बकाया बिल', 'days': 'दिन', 'Customers': 'ग्राहक', 'Search name or mobile': 'नाम या मोबाइल खोजें', 'Pending': 'बाकी', 'All': 'सभी',
  'Last bill': 'आख़िरी बिल', 'Paid': 'चुकाया', 'Due': 'बाकी', 'Settled': 'चुकता', 'Receive': 'पैसे लें', 'Reminder': 'रिमाइंडर', 'No udhar yet': 'अभी कोई उधार नहीं',
  'Recent udhar payments': 'हाल में मिला उधार', 'Receive udhar': 'उधार वसूलें', 'Received at shop': 'किस दुकान पर मिला', 'optional': 'वैकल्पिक', 'Save payment': 'भुगतान सेव करें',
  'Payment saved': 'भुगतान सेव हुआ', 'received': 'मिला', 'Send receipt on WhatsApp': 'WhatsApp पर रसीद भेजें', 'Amount must be between ₹1 and the due amount': 'राशि ₹1 और बाकी उधार के बीच होनी चाहिए',
  'Udhar given today': 'आज दिया उधार', 'Collected today': 'आज वसूला', 'Open Udhar →': 'उधार खोलें →', 'Discounts given': 'दी गई छूट',
  'Udhar given (not in drawer)': 'दिया उधार (दराज़ में नहीं)', 'Udhar collected in cash': 'नकद में वसूला उधार', 'Udhar collected by UPI': 'UPI से वसूला उधार',
  'Udhar bill': 'उधार बिल', 'Udhar received': 'उधार मिला', 'Udhar reminder sent': 'उधार रिमाइंडर भेजा', 'Discount given': 'छूट दी',
  'Edit': 'बदलें', 'Edit product': 'प्रोडक्ट बदलें', 'Product photo': 'प्रोडक्ट फ़ोटो', 'Add photo': 'फ़ोटो जोड़ें', 'Change photo': 'फ़ोटो बदलें', 'Save changes': 'बदलाव सेव करें',
  'Hide this product (stop selling it)': 'यह प्रोडक्ट छिपाएँ (बिक्री बंद करें)', 'Hidden': 'छिपा हुआ', 'Edited': 'बदला गया', 'Product updated': 'प्रोडक्ट अपडेट हुआ', 'Product edited': 'प्रोडक्ट बदला',
  'MuneemX master product: you can change the MRP, cost and photo for your shops. Name, pack and barcode stay as in the master list.': 'MuneemX मास्टर प्रोडक्ट: आप अपनी दुकानों के लिए MRP, लागत और फ़ोटो बदल सकते हैं। नाम, पैक और बारकोड मास्टर सूची जैसे ही रहेंगे।',
  'New MRP applies to bills from now on. Old bills keep the price they were sold at.': 'नया MRP अब से बनने वाले बिलों पर लागू होगा। पुराने बिल अपने दाम पर रहेंगे।',
  'Brand and barcode are required.': 'ब्रांड और बारकोड ज़रूरी हैं।', 'Enter a valid MRP and cost.': 'सही MRP और लागत डालें।', 'Could not read that image': 'यह फ़ोटो पढ़ी नहीं जा सकी',
  // ---- sign-in ----
  'Sign in': 'लॉगिन करें', "Who's signing in?": 'कौन लॉगिन कर रहा है?', 'Workspace': 'वर्कस्पेस', 'PIN': 'पिन', 'Every demo PIN is': 'हर डेमो पिन है',
  'Every bottle scanned. Every rupee accounted.': 'हर बोतल स्कैन। हर रुपये का हिसाब।', 'Run every liquor shop on one platform.': 'हर शराब दुकान एक ही प्लेटफ़ॉर्म पर चलाएँ।',
  'Scan-locked billing, live sales by the minute, stock, expenses and staff salary in one place.': 'स्कैन-लॉक बिलिंग, मिनट-दर-मिनट लाइव बिक्री, स्टॉक, खर्च और स्टाफ़ वेतन — सब एक जगह।',
  'Scan-locked sales': 'स्कैन-लॉक बिक्री', 'Only products matched in the database can be billed.': 'सिर्फ़ डेटाबेस से मैच हुए प्रोडक्ट का ही बिल बनता है।',
  'AI label scan': 'AI लेबल स्कैन', 'Photo of a bottle → matched to your catalog.': 'बोतल की फ़ोटो → आपके कैटलॉग से मैच।',
  'Live per-minute sales': 'मिनट-दर-मिनट लाइव बिक्री', 'Cash vs UPI, per shop, per salesman.': 'कैश बनाम UPI, दुकान-वार, सेल्समैन-वार।',
  'Tamper-evident bills': 'छेड़छाड़-रोधी बिल', 'Each bill is chained to the previous one.': 'हर बिल पिछले बिल से जुड़ा है।',
  'Owner / Contractor': 'मालिक / ठेकेदार', 'Shop manager': 'शॉप मैनेजर', 'Salesman': 'सेल्समैन', 'MuneemX platform': 'MuneemX प्लेटफ़ॉर्म',
  'MuneemX Platform (super admin)': 'MuneemX प्लेटफ़ॉर्म (सुपर एडमिन)', 'Liquor Retail OS': 'शराब रिटेल सिस्टम',
  'Staff PIN': 'स्टाफ़ पिन', 'Owner / Admin': 'मालिक / एडमिन', 'New business': 'नया व्यवसाय', 'Counter sign-in': 'काउंटर लॉगिन',
  'Salesmen and managers sign in with their username and PIN.': 'सेल्समैन और मैनेजर अपने यूज़रनेम और पिन से लॉगिन करते हैं।',
  'Workspace code': 'वर्कस्पेस कोड', 'Username': 'यूज़रनेम', 'Owner sign-in': 'मालिक लॉगिन', 'Owners and the MuneemX platform admin sign in with e-mail.': 'मालिक और MuneemX एडमिन ई-मेल से लॉगिन करते हैं।',
  'E-mail': 'ई-मेल', 'Password': 'पासवर्ड', 'Password (min 6)': 'पासवर्ड (कम से कम 6)', 'Create a business account': 'व्यवसाय खाता बनाएँ',
  "Start your own MuneemX workspace. You'll set up your shop next.": 'अपना MuneemX वर्कस्पेस शुरू करें। अगले चरण में दुकान सेट करेंगे।', 'Create account': 'खाता बनाएँ',
  'Wrong workspace, username or PIN': 'वर्कस्पेस, यूज़रनेम या पिन गलत है', 'Wrong e-mail or password': 'ई-मेल या पासवर्ड गलत है', 'Wrong PIN. Demo PIN is 1234.': 'गलत पिन। डेमो पिन 1234 है।',
  'Set up your workspace': 'अपना वर्कस्पेस सेट करें', 'Set up your business': 'अपना व्यवसाय सेट करें', 'Your name': 'आपका नाम', 'Your username': 'आपका यूज़रनेम',
  'Approval PIN (4–6 digits)': 'मंज़ूरी पिन (4–6 अंक)', 'The approval PIN is what you type when approving overrides, voids and salary payments.': 'मंज़ूरी पिन override, बिल रद्द और वेतन भुगतान मंज़ूर करते समय डाला जाता है।',
  // ---- common ----
  'Cancel': 'रद्द करें', 'Close': 'बंद करें', 'Done': 'हो गया', 'Continue': 'आगे बढ़ें', 'Save': 'सेव करें', 'Add': 'जोड़ें', 'Remove': 'हटाएँ', 'View': 'देखें', 'Print': 'प्रिंट',
  'Reset': 'रीसेट', 'Approve': 'मंज़ूर करें', 'Change': 'बदलें', 'Search': 'खोजें', 'Name': 'नाम', 'Phone': 'फ़ोन', 'Role': 'रोल', 'Shop': 'दुकान', 'Shops': 'दुकानें',
  'Date': 'तारीख़', 'Time': 'समय', 'When': 'कब', 'Who': 'कौन', 'Action': 'काम', 'Detail': 'विवरण', 'Note': 'नोट', 'Amount': 'राशि', 'Amount ₹': 'राशि ₹', 'Total': 'कुल',
  'Product': 'प्रोडक्ट', 'Pack': 'पैक', 'Barcode': 'बारकोड', 'MRP': 'MRP', 'MRP ₹': 'MRP ₹', 'Cost': 'लागत', 'Cost ₹': 'लागत ₹', 'Stock': 'स्टॉक', 'Value': 'मूल्य', 'Units': 'यूनिट',
  'Category': 'श्रेणी', 'Brand': 'ब्रांड', 'Variant': 'वैरिएंट', 'Size (ml)': 'साइज़ (ml)', 'Source': 'स्रोत', 'Status': 'स्थिति', 'Type': 'प्रकार', 'Plan': 'प्लान', 'City': 'शहर',
  'Reason': 'कारण', 'Mode': 'तरीका', 'Payment': 'भुगतान', 'Items': 'आइटम', 'Bill': 'बिल', 'Sales': 'बिक्री', 'Margin': 'मार्जिन', 'Net': 'शुद्ध', 'Code': 'कोड', 'Licence': 'लाइसेंस',
  'OK': 'ठीक', 'Low': 'कम', 'Out': 'ख़त्म', 'locked': 'लॉक', 'Everyone': 'सभी', 'all': 'सभी', 'All bills': 'सभी बिल', 'All categories': 'सभी श्रेणियाँ', 'Today': 'आज', 'Yesterday': 'कल',
  'No match': 'कोई मैच नहीं', 'No bills': 'कोई बिल नहीं', 'Nothing yet': 'अभी कुछ नहीं', 'None': 'कोई नहीं', 'None yet': 'अभी कोई नहीं', 'Something went wrong on this screen:': 'इस स्क्रीन पर गड़बड़ हुई:',
  'Copied to clipboard': 'कॉपी हो गया', 'Copy blocked by the browser': 'ब्राउज़र ने कॉपी रोक दिया', 'Copy CSV': 'CSV कॉपी करें', 'Copy receipt': 'रसीद कॉपी करें',
  // packs & categories
  'Full': 'फुल', 'Half': 'हाफ़', 'Quarter': 'क्वार्टर', 'Pint': 'पिंट', 'Can': 'कैन', 'Bottle': 'बोतल', 'Nip': 'निप',
  'Whisky': 'व्हिस्की', 'Scotch': 'स्कॉच', 'Rum': 'रम', 'Vodka': 'वोडका', 'Brandy': 'ब्रांडी', 'Gin': 'जिन', 'Beer': 'बीयर', 'Wine': 'वाइन',
  'Cash': 'नकद', 'UPI': 'UPI', 'Split': 'स्प्लिट', 'Bank': 'बैंक',
  // ---- dashboard ----
  'Sales today': 'आज की बिक्री', 'vs same time yesterday': 'कल इसी समय की तुलना में', 'Bills · Bottles': 'बिल · बोतलें', 'Cash · UPI': 'नकद · UPI', 'digital': 'डिजिटल',
  'Gross margin − expenses': 'सकल मार्जिन − खर्च', 'Sales by hour': 'घंटे के अनुसार बिक्री', 'Today vs yesterday': 'आज बनाम कल', 'Last 60 minutes': 'पिछले 60 मिनट',
  '₹ per minute': '₹ प्रति मिनट', 'Live bill feed': 'लाइव बिल फ़ीड', 'No bills yet today': 'आज अभी कोई बिल नहीं', 'Top products today': 'आज के टॉप प्रोडक्ट', 'Qty': 'मात्रा',
  'Units by pack': 'पैक के अनुसार यूनिट', 'Control flags today': 'आज के नियंत्रण संकेत', 'Manual-override bills': 'मैनुअल-override बिल', 'Voided bills': 'रद्द बिल',
  'Low / out of stock SKUs': 'कम / ख़त्म स्टॉक वाले प्रोडक्ट', 'Salesman leaderboard': 'सेल्समैन लीडरबोर्ड', 'Shops today': 'आज दुकानें', 'Last 7 days': 'पिछले 7 दिन',
  'Reorder alerts': 'री-ऑर्डर अलर्ट', 'Inventory →': 'स्टॉक →', 'All stocked up': 'सब स्टॉक में है',
  // ---- scan & sell ----
  'Scan product': 'प्रोडक्ट स्कैन करें', 'Scan-lock on': 'स्कैन-लॉक चालू', 'Scan-lock off': 'स्कैन-लॉक बंद', 'Scan or type barcode ⏎': 'बारकोड स्कैन करें या लिखें ⏎',
  'Camera': 'कैमरा', 'Photo': 'फ़ोटो', 'AI scan': 'AI स्कैन', 'Live camera scanner': 'लाइव कैमरा स्कैनर', 'Photo of barcode': 'बारकोड की फ़ोटो',
  'USB / Bluetooth scanners work anywhere on this screen.': 'USB / Bluetooth स्कैनर इस स्क्रीन पर कहीं भी काम करते हैं।',
  'scans live with the phone or webcam. A new bottle barcode is linked to its product once, then it bills every time.': 'फ़ोन या वेबकैम से लाइव स्कैन करता है। नई बोतल का बारकोड एक बार प्रोडक्ट से जोड़ें, फिर हर बार बिल बनेगा।',
  'Quick scan': 'क्विक स्कैन', 'Tap a barcode to simulate a scan': 'स्कैन जैसा करने के लिए बारकोड दबाएँ', 'Top sellers — tap to add': 'सबसे ज़्यादा बिकने वाले — दबाकर जोड़ें', 'Unknown product': 'अनजान प्रोडक्ट',
  'Find without scanning': 'बिना स्कैन खोजें', 'Needs manager PIN': 'मैनेजर पिन चाहिए', 'Search brand, e.g. Royal Stag quarter': 'ब्रांड खोजें, जैसे Royal Stag quarter',
  'Current bill': 'मौजूदा बिल', 'Scan a bottle to start the bill': 'बिल शुरू करने के लिए बोतल स्कैन करें', 'item': 'आइटम', 'items': 'आइटम', 'Prices locked at MRP': 'दाम MRP पर लॉक',
  'Cash received': 'मिला नकद', 'Return change': 'लौटाने वाले पैसे', 'Cash part': 'नकद हिस्सा', 'UPI part:': 'UPI हिस्सा:', 'Customer scans to pay': 'ग्राहक स्कैन करके भुगतान करे',
  'Set the UPI ID in Settings': 'सेटिंग्स में UPI ID डालें', 'UTR / ref no. (optional)': 'UTR / रेफ़ नंबर (वैकल्पिक)', 'Payment received on phone': 'फ़ोन पर भुगतान मिल गया',
  'Clear bill': 'बिल साफ़ करें', 'My bills today:': 'आज मेरे बिल:', 'My sales:': 'मेरी बिक्री:', 'Scanned': 'स्कैन हुआ', 'AI': 'AI', 'Override': 'Override', 'Manual': 'मैनुअल',
  'Sale locked — barcode': 'बिक्री लॉक — बारकोड', 'is not in your product database.': 'आपके प्रोडक्ट डेटाबेस में नहीं है।', 'Link to a product': 'प्रोडक्ट से जोड़ें',
  'Pick a counter': 'काउंटर चुनें', 'Billing happens at one shop. Choose which shop you are selling from.': 'बिलिंग एक दुकान से होती है। चुनें आप किस दुकान से बेच रहे हैं।',
  "Choose the shop counter you're billing from.": 'वह दुकान चुनें जहाँ से बिल बना रहे हैं।', 'Pick shop': 'दुकान चुनें', 'Next customer': 'अगला ग्राहक',
  'Manager approval': 'मैनेजर की मंज़ूरी', 'Approver': 'मंज़ूरी देने वाला', 'Approval PIN': 'मंज़ूरी पिन', 'Wrong PIN': 'गलत पिन',
  'For split, enter a cash part between ₹1 and the bill total.': 'स्प्लिट के लिए ₹1 और बिल कुल के बीच नकद हिस्सा डालें।', 'Stock lock — not enough stock': 'स्टॉक लॉक — स्टॉक पर्याप्त नहीं',
  'Scan-lock is on and overrides are disabled. Scan the product.': 'स्कैन-लॉक चालू है और override बंद है। प्रोडक्ट स्कैन करें।',
  'Reading barcode from photo…': 'फ़ोटो से बारकोड पढ़ रहे हैं…', 'No barcode found in the photo. Try a sharper, closer shot — or use AI scan.': 'फ़ोटो में बारकोड नहीं मिला। पास से साफ़ फ़ोटो लें — या AI स्कैन करें।',
  'AI is reading the label…': 'AI लेबल पढ़ रहा है…', 'Bill voided, stock restored': 'बिल रद्द, स्टॉक वापस जुड़ा',
  // camera & linking
  'Camera scanner': 'कैमरा स्कैनर', 'Point the camera at the barcode. Hold steady, 10–20 cm away.': 'कैमरा बारकोड पर रखें। 10–20 सेमी दूर, स्थिर पकड़ें।', 'Keep scanning': 'स्कैन जारी रखें',
  'Switch camera': 'कैमरा बदलें', 'Loading scanner…': 'स्कैनर लोड हो रहा है…', 'Camera permission was refused. Allow camera access in the browser settings, or use Photo.': 'कैमरा अनुमति नहीं मिली। ब्राउज़र सेटिंग्स में कैमरा अनुमति दें, या फ़ोटो इस्तेमाल करें।',
  'Camera is not available in this browser. Use Photo instead.': 'इस ब्राउज़र में कैमरा उपलब्ध नहीं। फ़ोटो इस्तेमाल करें।', 'Scanner could not start. Use Photo instead.': 'स्कैनर शुरू नहीं हुआ। फ़ोटो इस्तेमाल करें।',
  'Link this barcode': 'यह बारकोड जोड़ें', 'Link barcode': 'बारकोड जोड़ें', 'Linked': 'जुड़ गया',
  'is not in your database yet. Pick the product this bottle is — every future scan of this barcode will bill it.': 'अभी आपके डेटाबेस में नहीं है। यह बोतल कौन-सा प्रोडक्ट है, चुनें — आगे हर स्कैन पर इसी का बिल बनेगा।',
  'Link barcodes': 'बारकोड जोड़ें', 'Teach your real barcodes': 'अपने असली बारकोड सिखाएँ', 'Linked barcodes': 'जुड़े हुए बारकोड', 'No linked barcodes yet — scan a bottle to start': 'अभी कोई बारकोड नहीं जुड़ा — शुरू करने के लिए बोतल स्कैन करें',
  "Bottles from your depot carry the manufacturer's barcode. Scan each new bottle once here and pick its product. After that, Scan & Sell bills it instantly at every shop.": 'डिपो से आई बोतलों पर कंपनी का बारकोड होता है। हर नई बोतल यहाँ एक बार स्कैन करके उसका प्रोडक्ट चुनें। उसके बाद हर दुकान पर तुरंत बिल बनेगा।',
  'This barcode already belongs to another product': 'यह बारकोड पहले से दूसरे प्रोडक्ट का है', 'Manager approval needed': 'मैनेजर की मंज़ूरी चाहिए',
  // receipts & bills
  'Salesman:': 'सेल्समैन:', 'TOTAL': 'कुल', 'Paid:': 'भुगतान:', 'Void bill': 'बिल रद्द करें', 'Business day': 'कारोबारी दिन', 'Flags': 'संकेत', 'Staff': 'स्टाफ़',
  'Manual override': 'मैनुअल override', 'AI scanned': 'AI स्कैन', 'Voided': 'रद्द', 'Verify ledger': 'लेजर जाँचें', 'Ledger integrity': 'लेजर की शुद्धता', 'Chain intact': 'चेन सही है',
  "Each bill's lock code is computed from its contents and the previous bill's code. Editing or deleting any past bill breaks the chain from that point on.": 'हर बिल का लॉक कोड उसकी जानकारी और पिछले बिल के कोड से बनता है। किसी पुराने बिल को बदलने या मिटाने पर वहाँ से चेन टूट जाती है।',
  'The bill stays in the ledger marked VOID and stock goes back. A reason and manager PIN are required.': 'बिल लेजर में VOID लिखा रहता है और स्टॉक वापस जुड़ता है। कारण और मैनेजर पिन ज़रूरी है।',
  'Customer returned sealed bottle': 'ग्राहक ने सील बंद बोतल लौटाई', 'Wrong item scanned': 'गलत आइटम स्कैन हुआ', 'Duplicate bill': 'डुप्लिकेट बिल', 'Payment failed': 'भुगतान फ़ेल', 'Loading older bills…': 'पुराने बिल लोड हो रहे हैं…', 'Loading…': 'लोड हो रहा है…',
  // inventory
  'Stock inward': 'माल आवक', 'Transfer': 'ट्रांसफ़र', 'Physical count': 'भौतिक गिनती', 'Daily register': 'दैनिक रजिस्टर', 'Product catalog': 'प्रोडक्ट कैटलॉग',
  'SKUs': 'प्रोडक्ट (SKU)', 'Units in stock': 'स्टॉक में यूनिट', 'Stock value (cost)': 'स्टॉक मूल्य (लागत)', 'Stock value (MRP)': 'स्टॉक मूल्य (MRP)', 'Search product or barcode': 'प्रोडक्ट या बारकोड खोजें',
  'Receive stock': 'माल प्राप्त करें', 'Supplier / depot': 'सप्लायर / डिपो', 'Invoice / permit no.': 'इनवॉइस / परमिट नं.', 'Add products (scan cases or search)': 'प्रोडक्ट जोड़ें (पेटी स्कैन करें या खोजें)',
  'Scan barcode or search product': 'बारकोड स्कैन करें या प्रोडक्ट खोजें', 'Lines': 'लाइनें', 'Qty (bottles)': 'मात्रा (बोतलें)', 'Receive into stock': 'स्टॉक में जोड़ें', 'Scan or search products to add them': 'प्रोडक्ट जोड़ने के लिए स्कैन करें या खोजें',
  'Recent receipts': 'हाल की आवक', 'Ref': 'रेफ़', 'Supplier': 'सप्लायर', 'Stock received': 'माल प्राप्त हुआ', 'e.g. State Beverages Depot': 'जैसे राज्य बेवरेजेज़ डिपो',
  'Move stock between shops': 'दुकानों के बीच माल भेजें', 'From shop': 'किस दुकान से', 'To shop': 'किस दुकान को', 'Add products': 'प्रोडक्ट जोड़ें', 'Transfer lines': 'ट्रांसफ़र लाइनें', 'Add products to move': 'भेजने के लिए प्रोडक्ट जोड़ें',
  'Pick two different shops': 'दो अलग दुकानें चुनें', 'Physical stock count': 'भौतिक स्टॉक गिनती', 'Count shelves, enter what you see. Differences are posted as adjustments and logged.': 'रैक गिनें, जो दिखे वह डालें। अंतर समायोजन के रूप में दर्ज होकर लॉग होता है।',
  'System': 'सिस्टम', 'Counted': 'गिना गया', 'Variance': 'अंतर', 'Post adjustments': 'समायोजन दर्ज करें', 'Daily stock register': 'दैनिक स्टॉक रजिस्टर',
  'Opening + received − sold = closing, per product': 'शुरुआती + आया − बिका = अंतिम, हर प्रोडक्ट', 'Opening': 'शुरुआती', 'Received': 'आया', 'Sold': 'बिका', 'Closing': 'अंतिम', 'Sales ₹': 'बिक्री ₹',
  'Enroll a product': 'प्रोडक्ट जोड़ें', 'Fill from label photo': 'लेबल फ़ोटो से भरें', 'Barcode from photo': 'फ़ोटो से बारकोड', 'scan or leave blank': 'स्कैन करें या खाली छोड़ें', 'auto 84% of MRP': 'अपने-आप MRP का 84%',
  'Save to database': 'डेटाबेस में सेव करें', 'Once saved, the product can be billed by barcode or AI label scan at every shop in this workspace. Unknown products stay locked out of billing.': 'सेव होने के बाद यह प्रोडक्ट हर दुकान पर बारकोड या AI लेबल स्कैन से बिल हो सकता है। अनजान प्रोडक्ट बिलिंग से लॉक रहते हैं।',
  'Your catalog': 'आपका कैटलॉग', 'Master': 'मास्टर', 'Added': 'जोड़ा गया', 'AI enrolled': 'AI से जोड़ा', 'Brand and MRP are required.': 'ब्रांड और MRP ज़रूरी हैं।', 'That barcode already exists in your database.': 'यह बारकोड पहले से आपके डेटाबेस में है।',
  'Barcode not in catalog': 'बारकोड कैटलॉग में नहीं', 'Reading barcode…': 'बारकोड पढ़ रहे हैं…', 'No barcode found in that photo.': 'उस फ़ोटो में बारकोड नहीं मिला।',
  // expenses
  'Add expense': 'खर्च जोड़ें', 'Paid by': 'भुगतान तरीका', 'e.g. Ice & glasses': 'जैसे बर्फ़ और गिलास', 'Cash expenses are deducted from expected cash at day close.': 'नकद खर्च दिन के हिसाब में अपेक्षित नकद से घटता है।',
  'This month by category': 'इस महीने श्रेणी-वार', 'Expenses this month': 'इस महीने का खर्च', 'Gross margin this month': 'इस महीने का सकल मार्जिन', 'Expense / margin': 'खर्च / मार्जिन',
  'No expenses yet': 'अभी कोई खर्च नहीं', 'Enter an amount': 'राशि डालें', 'Expense added': 'खर्च जुड़ गया',
  'Rent': 'किराया', 'Electricity': 'बिजली', 'Salary': 'वेतन', 'Transport': 'ट्रांसपोर्ट', 'Tea & snacks': 'चाय-नाश्ता', 'Maintenance': 'मरम्मत', 'Security': 'सुरक्षा', 'Licence & fees': 'लाइसेंस व फ़ीस',
  'Breakage': 'टूट-फूट', 'Police/Local': 'पुलिस/स्थानीय', 'Other': 'अन्य',
  // staff
  'Team & payroll': 'टीम और वेतन', 'Attendance': 'हाज़िरी', 'Advances': 'एडवांस', 'Advance': 'एडवांस', 'Team': 'टीम', 'Add staff': 'स्टाफ़ जोड़ें', 'Role · Shop': 'रोल · दुकान',
  'Monthly salary': 'मासिक वेतन', 'Monthly salary ₹': 'मासिक वेतन ₹', 'P / ½ / A': 'हा / ½ / ग़ै', 'Sales (month)': 'बिक्री (महीना)', 'Earned': 'कमाया', 'Commission': 'कमीशन', 'Payable': 'देय',
  'Pay': 'भुगतान करें', 'Paid': 'भुगतान हुआ', 'Commission earned': 'कमाया कमीशन', 'Advances this month': 'इस महीने के एडवांस', 'No staff yet': 'अभी कोई स्टाफ़ नहीं',
  'Tap a day to cycle Present → Half → Absent': 'दिन दबाएँ: हाज़िर → आधा → ग़ैरहाज़िर', 'Give advance': 'एडवांस दें', 'Record advance': 'एडवांस दर्ज करें', "Deducted from this month's payable.": 'इस महीने की देय राशि से कटेगा।',
  'Username (for login)': 'यूज़रनेम (लॉगिन के लिए)', 'Commission % of sales': 'बिक्री पर कमीशन %', 'Add': 'जोड़ें', 'They sign in on the counter with workspace code': 'वे काउंटर पर वर्कस्पेस कोड',
  ', their username and this PIN. Managers also use it as their approval PIN.': ', अपने यूज़रनेम और इस पिन से लॉगिन करते हैं। मैनेजर इसे मंज़ूरी पिन के रूप में भी इस्तेमाल करते हैं।',
  'Name and username are required.': 'नाम और यूज़रनेम ज़रूरी हैं।', 'Salary recorded': 'वेतन दर्ज हुआ', 'Enter amount': 'राशि डालें',
  // reports
  'Day close': 'दिन का हिसाब', 'Monthly P&L': 'मासिक लाभ-हानि', 'Brand performance': 'ब्रांड प्रदर्शन', 'Audit trail': 'ऑडिट ट्रेल', 'Close the day': 'दिन बंद करें',
  'UPI received': 'मिला UPI', 'Cash sales': 'नकद बिक्री', 'Cash expenses paid from counter': 'काउंटर से दिए नकद खर्च', 'Expected cash in drawer': 'दराज़ में अपेक्षित नकद',
  'Cash counted in drawer ₹': 'दराज़ में गिना नकद ₹', 'Cash tallies exactly.': 'नकद बिल्कुल बराबर है।', 'Close day & lock': 'दिन बंद करें और लॉक करें', 'Copy closing summary': 'दिन का सारांश कॉपी करें',
  'Collection by salesman': 'सेल्समैन-वार वसूली', 'Cash to hand over': 'सौंपने वाला नकद', 'Exceptions': 'अपवाद', 'Issue': 'समस्या', 'No exceptions 🎉': 'कोई अपवाद नहीं 🎉', 'Void': 'रद्द', 'Day closed': 'दिन बंद हुआ',
  'Cost of goods sold': 'बिके माल की लागत', 'Salary accrued, not yet paid': 'बकाया वेतन (अभी नहीं दिया)', 'Net profit': 'शुद्ध लाभ', 'Per shop': 'दुकान-वार', 'Expenses': 'खर्च',
  'Brand performance — last 7 days': 'ब्रांड प्रदर्शन — पिछले 7 दिन', 'Pack mix': 'पैक मिश्रण', 'Share': 'हिस्सा', 'No sales yet': 'अभी कोई बिक्री नहीं',
  'Every override, void, stock change and payment': 'हर override, रद्द बिल, स्टॉक बदलाव और भुगतान', 'Shows the latest 300 entries loaded at sign-in. Sign out and in again to refresh.': 'लॉगिन के समय लोड हुई आख़िरी 300 एंट्री। ताज़ा करने के लिए फिर से लॉगिन करें।',
  'Platform Admin': 'प्लेटफ़ॉर्म एडमिन', 'Workspace provisioned': 'वर्कस्पेस बनाया गया', 'Bill voided': 'बिल रद्द', 'Bill with manual override': 'मैनुअल override वाला बिल', 'Unknown barcode scanned': 'अनजान बारकोड स्कैन',
  'Manual add approved': 'मैनुअल जोड़ मंज़ूर', 'Stock transfer': 'स्टॉक ट्रांसफ़र', 'Stock count posted': 'स्टॉक गिनती दर्ज', 'Product enrolled': 'प्रोडक्ट जोड़ा', 'Expense added': 'खर्च जोड़ा',
  'Salary paid': 'वेतन दिया', 'Advance given': 'एडवांस दिया', 'Staff added': 'स्टाफ़ जोड़ा', 'Shop added': 'दुकान जोड़ी', 'Settings updated': 'सेटिंग्स बदलीं', 'Barcode linked': 'बारकोड जोड़ा', 'Barcode unlinked': 'बारकोड हटाया',
  'Wrong approval PIN': 'गलत मंज़ूरी पिन', 'Admin opened workspace': 'एडमिन ने वर्कस्पेस खोला', 'Policy changed': 'नीति बदली', 'Branding updated': 'ब्रांडिंग बदली',
  // settings
  'White-label branding': 'White-label ब्रांडिंग', 'Workspace code:': 'वर्कस्पेस कोड:', 'Business name': 'व्यवसाय का नाम', 'Logo initials': 'लोगो के अक्षर', 'Tagline': 'टैगलाइन', 'Brand colour': 'ब्रांड रंग',
  'Workspace code (staff type this to sign in)': 'वर्कस्पेस कोड (स्टाफ़ लॉगिन में डालता है)', 'Receipt footer': 'रसीद का फ़ुटर', 'Save branding': 'ब्रांडिंग सेव करें', 'Branding saved': 'ब्रांडिंग सेव हुई',
  'Sale-lock policies': 'सेल-लॉक नीतियाँ', 'Require scan to sell': 'बेचने के लिए स्कैन ज़रूरी', 'Only barcode or AI-matched products can be billed': 'सिर्फ़ बारकोड या AI से मैच प्रोडक्ट का बिल बनेगा',
  'Allow manager override': 'मैनेजर override की अनुमति', 'Manual add with manager PIN; flagged on the bill': 'मैनेजर पिन से मैनुअल जोड़; बिल पर चिह्नित', 'Lock price at MRP': 'दाम MRP पर लॉक',
  'Salesmen cannot change prices': 'सेल्समैन दाम नहीं बदल सकते', 'Block sale beyond stock': 'स्टॉक से ज़्यादा बिक्री रोकें', "Prevents billing bottles the system says you don't have": 'जो बोतलें सिस्टम में नहीं, उनका बिल नहीं बनेगा',
  'Age confirmation at checkout': 'बिल पर उम्र की पुष्टि', 'Salesman confirms legal drinking age on every bill': 'सेल्समैन हर बिल पर कानूनी उम्र की पुष्टि करता है', 'Legal drinking age': 'कानूनी उम्र', 'Varies by state': 'राज्य के अनुसार अलग',
  'Shops & UPI': 'दुकानें और UPI', 'UPI ID': 'UPI ID', 'Add shop': 'दुकान जोड़ें', 'Changes save when you leave a field': 'फ़ील्ड छोड़ते ही बदलाव सेव', 'Policy updated': 'नीति अपडेट हुई',
  'Demo tools': 'डेमो टूल', 'Connection': 'कनेक्शन', 'This demo keeps its data in this browser. Reset to regenerate 7 days of realistic sales.': 'यह डेमो डेटा इसी ब्राउज़र में रखता है। 7 दिन की नमूना बिक्री फिर बनाने के लिए रीसेट करें।',
  'Start live sales stream': 'लाइव बिक्री चालू करें', 'Stop live sales stream': 'लाइव बिक्री बंद करें', 'Reset demo data': 'डेमो डेटा रीसेट करें', 'Reset demo data?': 'डेमो डेटा रीसेट करें?',
  'All bills, stock, staff and settings in this browser go back to the starting demo.': 'इस ब्राउज़र के सभी बिल, स्टॉक, स्टाफ़ और सेटिंग्स शुरुआती डेमो पर लौट जाएँगे।',
  'Connected to Supabase. Bills, stock and staff are shared live across every device signed in to this workspace.': 'Supabase से जुड़ा है। बिल, स्टॉक और स्टाफ़ इस वर्कस्पेस के हर डिवाइस पर लाइव साझा होते हैं।',
  // platform
  'Client workspaces': 'क्लाइंट वर्कस्पेस', 'New client': 'नया क्लाइंट', 'Client': 'क्लाइंट', 'Users': 'यूज़र', '7 days': '7 दिन', 'MRR': 'MRR', 'Open workspace': 'वर्कस्पेस खोलें',
  'Shops on platform': 'प्लेटफ़ॉर्म पर दुकानें', 'GMV today': 'आज की कुल बिक्री', 'Plans': 'प्लान', 'Talk to us': 'संपर्क करें', 'No clients yet': 'अभी कोई क्लाइंट नहीं', 'Loading clients…': 'क्लाइंट लोड हो रहे हैं…',
  'New client workspace': 'नया क्लाइंट वर्कस्पेस', 'First shop name': 'पहली दुकान का नाम', 'Owner name': 'मालिक का नाम', 'Owner approval PIN': 'मालिक का मंज़ूरी पिन', 'Owner e-mail (login)': 'मालिक का ई-मेल (लॉगिन)',
  'Owner temporary password': 'मालिक का अस्थायी पासवर्ड', 'Create workspace': 'वर्कस्पेस बनाएँ', 'Individual shop': 'अकेली दुकान', 'Contractor': 'ठेकेदार', 'Bar / wholesale': 'बार / होलसेल',
  'Creates the workspace, first shop, owner login and a copy of the MuneemX master catalog. Stock starts at zero.': 'वर्कस्पेस, पहली दुकान, मालिक का लॉगिन और MuneemX मास्टर कैटलॉग की कॉपी बनती है। स्टॉक शून्य से शुरू।',
  'per shop / month': 'प्रति दुकान / माह', 'per month, up to 5 shops': 'प्रति माह, 5 दुकानों तक', 'custom': 'कस्टम', 'White-label partner': 'White-label पार्टनर',
  // roadmap
  'Compliance moat (hard to copy)': 'नियम-पालन (कॉपी करना मुश्किल)', 'Make owners more money': 'मालिकों की कमाई बढ़ाएँ', 'Revenue lines for MuneemX': 'MuneemX की कमाई के रास्ते', 'Product polish': 'प्रोडक्ट सुधार',
  'ctn': 'कार्टन', 'carton': 'कार्टन', 'Carton': 'कार्टन', 'cartons': 'कार्टन', 'bottles': 'बोतल', 'Bottles': 'बोतलें', 'Per carton': 'प्रति कार्टन', 'Cartons': 'कार्टन', '+ Bottles': '+ बोतलें', 'Total bottles': 'कुल बोतलें', 'Available': 'उपलब्ध', 'This barcode is on': 'यह बारकोड किस पर है', 'One bottle': 'एक बोतल', 'A carton / case': 'एक कार्टन / पेटी', 'Bottles in one carton': 'एक कार्टन में बोतलें', 'Each scan of this carton adds that many bottles.': 'इस कार्टन के हर स्कैन से इतनी बोतलें जुड़ेंगी।', 'Scan cartons or bottles': 'कार्टन या बोतल स्कैन करें', 'Scan carton / bottle barcode or search': 'कार्टन / बोतल बारकोड स्कैन करें या खोजें', 'Instant mode: each scan goes straight into stock': 'इंस्टेंट मोड: हर स्कैन सीधे स्टॉक में जुड़ेगा', 'A carton barcode adds the whole carton. A bottle barcode adds one bottle. Search adds one carton. New carton barcodes are linked once in Inventory → Link barcodes.': 'कार्टन बारकोड पूरा कार्टन जोड़ता है। बोतल बारकोड एक बोतल जोड़ता है। खोज से एक कार्टन जुड़ता है। नए कार्टन बारकोड एक बार इन्वेंटरी → बारकोड लिंक में जोड़ें।', 'Scanned into stock': 'स्टॉक में स्कैन हुआ', 'Scan a carton to add it to stock': 'स्टॉक में जोड़ने के लिए कार्टन स्कैन करें', 'Recent transfers': 'हाल के ट्रांसफ़र', 'Products': 'प्रोडक्ट', 'Transferred': 'ट्रांसफ़र हुआ', 'Stock is taken out of the sending shop and added to the receiving shop in one step. Both shops see it in their Daily register and in Reports → Stock movements.': 'माल भेजने वाली दुकान से घटकर पाने वाली दुकान में एक ही बार में जुड़ जाता है। दोनों दुकानें इसे दैनिक रजिस्टर और रिपोर्ट → स्टॉक मूवमेंट में देखती हैं।', 'Some lines are more than the stock at the sending shop.': 'कुछ लाइनें भेजने वाली दुकान के स्टॉक से ज़्यादा हैं।', 'Transfer in': 'ट्रांसफ़र आया', 'Transfer out': 'ट्रांसफ़र गया', 'Adjust': 'समायोजन', 'Opening + received + transfer in − transfer out ± adjust − sold = closing': 'शुरुआती + प्राप्त + ट्रांसफ़र आया − ट्रांसफ़र गया ± समायोजन − बिका = अंतिम', 'Main store': 'मुख्य स्टोर', 'Main store set': 'मुख्य स्टोर सेट हुआ', 'Owner WhatsApp number (reports are sent here)': 'मालिक का WhatsApp नंबर (रिपोर्ट यहाँ भेजी जाती है)', 'Sales report': 'बिक्री रिपोर्ट', 'Stock movements': 'स्टॉक मूवमेंट', 'This week': 'इस हफ़्ते', 'This month': 'इस महीने', 'Last month': 'पिछला महीना', 'Custom': 'कस्टम', 'All shops': 'सभी दुकानें', 'WhatsApp to owner': 'मालिक को WhatsApp', 'Summary': 'सारांश', 'Day by day': 'दिन-ब-दिन', 'Salesmen': 'सेल्समैन', 'Bottles sold': 'बिकी बोतलें', 'MRP value': 'MRP मूल्य', 'Discounts': 'छूट', 'Net sales': 'शुद्ध बिक्री', 'Udhar given': 'दिया गया उधार', 'Udhar collected': 'उधार वसूली', 'Gross margin': 'सकल मार्जिन', 'Net after expenses': 'खर्च के बाद शुद्ध', 'Stock movement': 'स्टॉक मूवमेंट', 'Transfers': 'ट्रांसफ़र', 'Send report on WhatsApp': 'WhatsApp पर रिपोर्ट भेजें', 'Owner WhatsApp number': 'मालिक का WhatsApp नंबर', 'Download PDF': 'PDF डाउनलोड करें', 'Open WhatsApp': 'WhatsApp खोलें', 'This device cannot attach files to WhatsApp directly. Download the PDF, then send the summary — attach the PDF in the chat if needed.': 'यह डिवाइस सीधे WhatsApp में फ़ाइल नहीं जोड़ सकता। PDF डाउनलोड करें, फिर सारांश भेजें — ज़रूरत हो तो चैट में PDF जोड़ें।', 'Save it in Settings → Owner WhatsApp number to skip this step.': 'यह कदम छोड़ने के लिए सेटिंग → मालिक का WhatsApp नंबर में सेव करें।',
};

// Patterns for text that contains numbers or names.
const HI_RX = [
  [/^(\d+) bills · (\d+) bottles$/, (m, a, b) => `${a} बिल · ${b} बोतलें`],
  [/^Discounts (.+)$/, (m, x) => `छूट ${x}`],
  [/^Carton × (\d+)$/, (m, n) => `कार्टन × ${n}`],
  [/^Gross sales \((\d+) bills\)$/, (m, n) => `कुल बिक्री (${n} बिल)`],
  [/^Payroll so far \((.+)\)$/, (m, x) => `अब तक का वेतन (${x})`],
  [/^Confirm & lock bill · (.+)$/, (m, x) => `कन्फ़र्म करें और बिल लॉक करें · ${x}`],
  [/^Avg bill (.+)$/, (m, x) => `औसत बिल ${x}`],
  [/^Margin (.+) · expenses (.+)$/, (m, a, b) => `मार्जिन ${a} · खर्च ${b}`],
  [/^Gross margin \((.+)\)$/, (m, x) => `सकल मार्जिन (${x})`],
  [/^All shops \((\d+)\)$/, (m, n) => `सभी दुकानें (${n})`],
  [/^PIN \((\d) digits\)$/, (m, n) => `पिन (${n} अंक)`],
  [/^(\d+)% digital$/, (m, n) => `${n}% डिजिटल`],
  [/^(\d+) items?$/, (m, n) => `${n} आइटम`],
  [/^(\d+) bills$/, (m, n) => `${n} बिल`],
  [/^(\d+) broken$/, (m, n) => `${n} टूटे`],
  [/^(\d+) left$/, (m, n) => `${n} बचे`],
  [/^stock (\d+)$/, (m, n) => `स्टॉक ${n}`],
  [/^Customer is (\d+)\+ \(legal drinking age checked\)$/, (m, n) => `ग्राहक ${n}+ उम्र का है (उम्र जाँची)`],
  [/^Short by (.+)$/, (m, x) => `${x} कम है`], [/^Excess cash (.+)$/, (m, x) => `${x} नकद ज़्यादा है`],
  [/^Earned = monthly salary ÷ (\d+) days/, (m, n) => `कमाया = मासिक वेतन ÷ ${n} दिन × (हाज़िर + ½ आधे दिन)। कमीशन सेल्समैन के लॉक बिलों का % है। भुगतान पर वेतन खर्च जुड़ता है।`],
  [/^Stock lock: only (\d+) of (.+) in stock/, (m, n, x) => `स्टॉक लॉक: ${x} सिर्फ़ ${n} स्टॉक में`],
  [/^Stock lock — only (\d+) of (.+) in stock at this shop\.$/, (m, n, x) => `स्टॉक लॉक — इस दुकान पर ${x} सिर्फ़ ${n} स्टॉक में।`],
  [/^Too many wrong PINs for (.+)\. Try again in 15 minutes\.$/, (m, x) => `${x} के लिए बहुत बार गलत पिन। 15 मिनट बाद कोशिश करें।`],
  [/^Approval expired — ask the manager to enter the PIN again$/, () => 'मंज़ूरी की समय-सीमा ख़त्म — मैनेजर से फिर पिन डलवाएँ'],
  [/^Bill (\S+) locked\. Stock updated\.$/, (m, x) => `बिल ${x} लॉक हुआ। स्टॉक अपडेट हुआ।`],
  [/^Void bill (\S+)\?$/, (m, x) => `बिल ${x} रद्द करें?`],
  [/^Attendance — (.+)$/, (m, x) => `हाज़िरी — ${x}`],
  [/^Profit & loss — (.+) to date$/, (m, x) => `लाभ-हानि — ${x} अब तक`],
  [/^(.+) can now sign in$/, (m, x) => `${x} अब लॉगिन कर सकता है`],
  [/^Signed in as (.+)\. This creates your branded workspace, first shop and owner profile\.$/, (m, x) => `${x} के रूप में लॉगिन। इससे आपका ब्रांडेड वर्कस्पेस, पहली दुकान और मालिक प्रोफ़ाइल बनेगी।`],
  [/^Platform admin viewing$/, () => 'प्लेटफ़ॉर्म एडमिन देख रहा है'],
  [/^(\d+) product\(s\) counted · net variance (.+) at cost$/, (m, n, x) => `${n} प्रोडक्ट गिने · कुल अंतर ${x} (लागत)`],
  [/^(\d+) products · (\d+) added by you · rest from MuneemX master list$/, (m, a, b) => `${a} प्रोडक्ट · ${b} आपके जोड़े · बाक़ी MuneemX मास्टर सूची से`],
  [/^(\d+) units · (.+) at cost$/, (m, a, b) => `${a} यूनिट · ${b} लागत`]
];

function t(s) {
  if (LANG.cur !== 'hi' || s == null) return s;
  const raw = String(s), k = raw.replace(/\s+/g, ' ').trim(); if (!k) return raw;
  let out = HI[k];
  if (out == null) for (const [rx, fn] of HI_RX) { const m = k.match(rx); if (m) { out = fn(...m); break; } }
  if (out == null && k.includes(' · ')) { const parts = k.split(' · '); const tr = parts.map(p => HI[p] != null ? HI[p] : p); if (tr.some((p, i) => p !== parts[i])) out = tr.join(' · '); }
  if (out == null) return raw;
  const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
  return lead + out + trail;
}

// translate a DOM subtree in place (text nodes, placeholders, titles)
function translateTree(root) {
  if (LANG.cur !== 'hi' || !root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = []; let n; while ((n = w.nextNode())) nodes.push(n);
  for (const node of nodes) {
    const p = node.parentElement; if (!p || p.closest('script,style,.mono,.notr')) continue;
    const v = node.nodeValue; if (!/[A-Za-z]{2}/.test(v)) continue;
    const tv = t(v); if (tv !== v) {
      if (p.tagName === 'OPTION' && !p.hasAttribute('value')) p.setAttribute('value', v.trim()); // keep the form value in English
      node.nodeValue = tv;
    }
  }
  const els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title]') : [];
  els.forEach(e => { if (e.placeholder) { const x = t(e.placeholder); if (x !== e.placeholder) e.placeholder = x; } if (e.title) { const x = t(e.title); if (x !== e.title) e.title = x; } });
}
(function () {
  let queued = false;
  const mo = new MutationObserver(() => { if (LANG.cur !== 'hi' || queued) return; queued = true; requestAnimationFrame(() => { queued = false; mo.disconnect(); translateTree(document.body); observe(); }); });
  const observe = () => mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  document.addEventListener('DOMContentLoaded', () => { document.documentElement.lang = LANG.cur; observe(); });
})();
function setLang(l) { LANG.cur = l; try { localStorage.setItem('mx_lang', l); } catch (e) { } document.documentElement.lang = l; }
