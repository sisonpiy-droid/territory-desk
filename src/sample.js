(function (root) {
var APP_HEAD = ['Application ID','Applicant name','City','State','Pin code','Investment capacity (₹ lakh)','Retail experience (years)','Current / past business','Space available','Space size (sq ft)','Floor','Target launch (months)','Preferred language','Notes from applicant'];
var APPS = [
 ['APP-001','Ravi Shankar','Mysuru','Karnataka',570001,25,4,'Runs a footwear store','Rented',450,'Ground',3,'Kannada','Wants to open before Diwali'],
 ['APP-002','Lakshmi Devi','Mysuru','Karnataka',570001,40,6,'Runs a mobile accessories shop','Owned',380,'Ground',2,'Kannada','Shop is on the main road'],
 ['APP-003','Mohammed Irfan','Mysuru','Karnataka',570002,30,2,'Garment retail','Rented',320,'Mall unit',4,'English',''],
 ['APP-004','Suresh Gowda','Mysuru','Karnataka',570008,28,0,'IT professional','Rented',400,'Ground',6,'Kannada','First business'],
 ['APP-005','Anitha Rao','Mysuru','Karnataka',570009,35,5,'Stationery shop owner','Rented',350,'Ground',3,'Kannada',''],
 ['APP-006','Prakash N','Mysuru','Karnataka',570099,30,3,'Electronics trading','Owned',500,'Ground',3,'English',''],
 ['APP-007','Divya Shetty','Mangaluru','Karnataka',575002,32,3,'Boutique owner','Not yet identified','','Not known',4,'Kannada','Looking for a ground floor shop near the market'],
 ['APP-008','Karthik B','Bengaluru','Karnataka',560002,55,8,'Supermarket store manager','Rented',600,'Ground',3,'English',''],
 ['APP-009','Farah Khan','Bengaluru','Karnataka',560050,38,2,'Cosmetics retail','Not yet identified','','Not known',3,'Hindi','Already have a ground floor shop, lease signed'],
 ['APP-010','Nikhil Joshi','Hubballi-Dharwad','Karnataka',580021,18,4,'Mobile shop','Rented',350,'Ground',3,'Hindi',''],
 ['APP-011','Basavaraj','Hubballi-Dharwad','Karnataka',580023,12,1,'Kirana store','Rented',300,'Ground',2,'Kannada',''],
 ['APP-012','Meera Iyer','Tumakuru','Karnataka',572101,22,1,'Tailoring shop','Not yet identified','','Not known',4,'Kannada','Will rent once approved'],
 ['APP-013','Ramesh Patil','Belagavi','Karnataka',590002,26,3,'Hardware shop','Owned',280,'Upper',3,'Kannada',''],
 ['APP-014','Sunita Hegde','Davanagere','Karnataka',577001,24,0,'Homemaker','Rented',300,'Ground',1,'Kannada','Bank loan sanction expected next month'],
 ['APP-015','Arjun Reddy','Bengaluru','Karnataka',560002,45,3,'Sports goods retail','Rented',500,'Ground',3,'English',''],
 ['APP-016','Pooja Menon','Bengaluru','Karnataka',560068,42,4,'Lifestyle store','Rented',420,'Mall unit',4,'Hindi',''],
 ['APP-017','Imran Sheikh','Tumakuru','Karnataka',575001,25,2,'Trading','Rented',320,'Ground',3,'English',''],
 ['APP-018','Girish Kamath','Tumakuru','Karnataka',572102,21,2,'Provision store','Rented',260,'Ground',3,'English',''],
 ['APP-019','Savitha K','Mysuru','Karnataka',570010,27,3,'Gift shop','Owned',330,'Ground',3,'Kannada',''],
 ['APP-020','Vinay Prasad','Mysuru','Karnataka',570011,33,4,'Optical shop assistant','Rented',400,'Ground',3,'Kannada','']
];
var TER_HEAD = ['Territory ID','City','State','Pin codes covered','City tier','Open slots','Priority'];
var TERS = [
 ['TER-01','Mysuru','Karnataka','570001, 570002, 570008, 570009','Tier 2',3,'High'],
 ['TER-02','Mysuru','Karnataka','570010, 570011, 570017','Tier 2',1,'Medium'],
 ['TER-03','Bengaluru','Karnataka','560002, 560034, 560038, 560050, 560068','Tier 1',2,'High'],
 ['TER-04','Bengaluru','Karnataka','560066, 560076, 560100, 560102','Tier 1',2,'Medium'],
 ['TER-05','Mangaluru','Karnataka','575001, 575002, 575003, 575006','Tier 2',1,'High'],
 ['TER-06','Hubballi-Dharwad','Karnataka','580020, 580021, 580023, 580029','Tier 2',2,'Medium'],
 ['TER-07','Belagavi','Karnataka','590001, 590002, 590006','Tier 2',1,'Low'],
 ['TER-08','Tumakuru','Karnataka','572101, 572102, 572103','Tier 3',2,'High'],
 ['TER-09','Davanagere','Karnataka','577001, 577002, 577004','Tier 3',1,'Medium']
];
var api = {
  appsAoA: [['Applications - one row per record. Enter data from row 3.'], APP_HEAD].concat(APPS),
  tersAoA: [['Territories - one row per record. Enter data from row 3.'], TER_HEAD].concat(TERS)
};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.SampleData = api;
})(typeof window !== 'undefined' ? window : globalThis);
