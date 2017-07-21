var MongoClient = require('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/test';

var time_to_update = true;
var last_updated_minute = 0;
var first_time_to_update = true;

var giant_copy = {};
var busy = false;
var giant_array = [];

var router = function (app) {

    app.get('/mongo-api/get/:tag_list/:start_date/:end_date/:variable?', function (req, res) {
	    MongoClient.connect(url, (err, db) => {
		    if(err){
			    return res.send({status:false, error:err});
		    }
		    
		    let start = new Date(req.params.start_date);
		    let end = new Date(req.params.end_date);
		    let find_query = {};
		    let fields_to_show = {};
		    let variable = req.params.variable || 'PV';
		    let tag_list = req.params.tag_list.split(',').map(function(item){
			    item = item + ":" + variable + ":";
			    return new RegExp("\^"+item);
			});
			
			start.setSeconds(0);
		    start.setMilliseconds(0);		    
		    end.setSeconds(0);
		    end.setMilliseconds(0);
			
			find_query = { _id: { $in:tag_list}, date: { $gte: start, $lte: end } };
			fields_to_show = {_id:0};
			
	        db.collection("past").find(find_query, fields_to_show).toArray(function(err, arr){
				db.collection("current").find(find_query, fields_to_show).toArray(function(err2, arr2){
					if(err || arr.length < 1){
						arr = [];
					}
					if(err2 || arr2.length < 1){
						arr2 = [];
					}
					res.json({data:arr.concat(arr2), current:getCurrent(giant_copy, req.params.tag_list, req.params.variable)});
					db.close();
				});
			});
		});
    });
    
    app.get('/mongo-api/getAllFromTagList/:tag_list/:start_date/:end_date', function (req, res) {
	    MongoClient.connect(url, (err, db) => {
		    if(err){
			    return res.send({status:false, error:err});
		    }
		    let start = new Date(req.params.start_date);
		    let end = new Date(req.params.end_date);
		    let find_query = {};
		    let fields_to_show = {};
		    let tag_list = req.params.tag_list.split(',').map(function(item){
			    item = item + ":";
			    return new RegExp("\^"+item);
			});
		    
		    start.setSeconds(0);
		    start.setMilliseconds(0);
		    end.setSeconds(0);
		    end.setMilliseconds(0);
		    
			find_query = { _id: { $in:tag_list}, date: { $gte: start, $lte: end } };
			fields_to_show = {_id:0};
			
	        db.collection("past").find(find_query, fields_to_show).toArray(function(err, arr){
				db.collection("current").find(find_query, fields_to_show).toArray(function(err2, arr2){
					let data;
					let current = [];
					if(err || arr.length < 1){
						arr = [];
					}
					if(err2 || arr2.length < 1){
						arr2 = [];
					}
					res.json({data:arr.concat(arr2), current:getCurrent(giant_copy, req.params.tag_list, req.params.variable)});
					db.close();
				});
			});
		});
    });
    
    app.get('/mongo-api/getLatest/:tag_list/:variable', function (req, res) {
	    MongoClient.connect(url, (err, db) => {
		    let variable = req.params.variable || 'PV';
		    let tag_list = req.params.tag_list.split(',').map(function(item){
			    item = item + ":" + variable + ":";
			    return new RegExp("\^"+item);
			})
	        db.collection("current").find({ _id:{ $in:tag_list }}).limit(tag_list.length*2).sort({date:-1}).toArray(function(err, arr){
				res.json({data:arr, current:getCurrent(giant_copy, req.params.tag_list, req.params.variable)});
				db.close();
			});
		});
    });
    
    app.get('/mongo-api/getCurrent/:tag_list/:variable', function (req, res) {
	    getCurrent(req.params.tag_list,req.params.variable, function(err, response, body){
		     if(err){
			     res.send({status:false, error:err});
			     return;
		     }
		     else{
			     res.send(body);
			     return;
		     }
	    });
    });
    
    app.get('/mongo-api/getTagsLike/:tags_like', function (req, res) {
	    if(req.params.tags_like && req.params.tags_like.length){
		    MongoClient.connect(url, (err, db) => {
		        db.collection("tags").find({ 
				    _id: { '$regex' : req.params.tags_like, '$options' : 'i' }
				})
				.limit(30)
				.toArray(function(err, arr){
					db.close();	
					res.send({data:arr});
				});
			});
		}
		else{
			res.send({status:false, message:'No tag name received'});
		}
    });	
}

var getCurrent = function(current_object, tag_list, variable){
	//request('http://localhost:3000/mongo-api/getCurrent/'+tag_list+'/'+variable, callback);
	let current = [];
	tag_list.split(',').forEach(function(item){
		let keys;
		let final_obj = {
			data : {}
		};
		if(!current[item.tag]){
			current[item.tag] = [];
		}
		if(giant_copy[item]){
			keys = Object.keys(giant_copy[item].data);
			giant_copy[item].tag = item;
			keys.forEach(function(key){
				let split_key = key.split(".");
				let obj = giant_copy[item];
				final_obj.date = obj.date;
				final_obj.tag = obj.tag;
				final_obj.var = obj.var;
				if(!final_obj.data[split_key[1]]){
					final_obj.data[split_key[1]] = {};
				}
				final_obj.data[split_key[1]][split_key[2]] = obj.data[key];
			});
			current.push(final_obj);
		}
	});
	return current;
}

module.exports = router;