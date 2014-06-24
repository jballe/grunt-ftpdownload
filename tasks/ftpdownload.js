'use strict';

module.exports = function (grunt) {

	grunt.registerMultiTask('ftpdownload', 'FTP Download', function() {
	    var Jsftp = require('jsftp');
	    var q = require('q');
	    var path = require('path');
	    var mkdirp = require('mkdirp');
		var async = require('async');

	    var done = this.async();

	    var ftp = new Jsftp({
	        host: this.data.auth.host,
	        user: this.data.auth.username,
	        pass: this.data.auth.password,
	        debugMode: this.data.debug || false
	    });

	    ftp.on('error', function(err) {
	        grunt.log.writeln('Error: ' + err);
	    });

	    if (this.data.src)
	        ftp.raw('cd', this.data.src);

	    grunt.log.writeln('Reading ' + this.data.src);

	    var files = [];
	    var buildTree = function (remotePath) {
	        var d = q.defer();
            ftp.ls(remotePath, function (err, response) {
                var promises = [];
                if (!response) {
                    d.resolve();
                    return;
                }

                async.eachLimit(response, 1, function (file, callback) {
                    var filePath = remotePath + '/' + file.name;
	                if (file.type == 1) {
	                    promises.push(buildTree(filePath));
	                } else {
	                    files.push({
	                        path: filePath,
	                        obj: file
	                    });
	                }
					
					callback();
                });
                q.all(promises).then(function() { d.resolve(); });
            });

	        return d.promise;
	    };

	    var data = this.data;
	    buildTree(this.data.src).then(function () {
	        grunt.log.writeln('Downloading ' + files.length + ' files...');

	        var promises = [];
			var executefunc = function(file, callback) {
	            var localPath = file.path.replace(data.src, data.dest);
	            var dir = path.dirname(localPath);
	            mkdirp(dir, function (createDirErr) {
                    if (createDirErr) {
                        grunt.log.warn('Error in ' + file.path + ': ' + createDirErr);
						callback();
                        return;
                    }

	                if (data.debug) {
	                    grunt.log.writeln('Download ' + file.path + ' to ' + localPath);
	                }

	                ftp.get(file.path, localPath, function(err) {
	                    if (err)
	                        grunt.log.warn('Error in ' + file.path + ': ' + err);
						callback();
	                });
				});
			};
			var queue = async.queue(executefunc, 1);
			queue.drain = function() {
				done();
			};
			queue.push(files);
	    });
	});
};