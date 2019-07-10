// TODO: Write a model for the friend

const mongoose = require('mongoose');

const friendSchema = new mongoose.Schema({
    name : {
        type : String ,
        required : true
    },
    owner : Schema.ObjectId,
    usernames : {
        type : Map,
        of : String
    } 
});

const friend = mongoose.model('Friend', friendSchema);

module.exports = friend ;