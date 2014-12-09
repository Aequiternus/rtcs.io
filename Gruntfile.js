module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        curl: {
            'client/adapter.js': 'http://webrtc.googlecode.com/svn/stable/samples/js/base/adapter.js'
        },

        less: {
            'public/rtcsio.jquery.css': 'client/View/default.jquery.less'
        },

        concat: {
            'public/rtcsio.jquery.js': [
                'client/adapter.js',
                'client/index.js',
                'client/localStream.js',
                'client/Socket.js',
                'client/Room.js',
                'client/Peer.js',
                'client/View/default.jquery.js'
            ]
        },

        surround: {
            jquery: {
                options: {
                    overwrite: true,
                    prepend: '(function($){',
                    append: '}(jQuery));'
                },
                src: 'public/rtcsio.jquery.js'
            }
        },

        cssmin: {
            css: {
                expand: true,
                src: 'public/*.css'
            }
        },

        uglify: {
            js: {
                expand: true,
                src: 'public/*.js'
            }
        },

        bump: {
            options: {
                pushTo: 'origin',
                commitFiles: ['.'],
                updateConfigs: ['pkg']
            }
        }
    });

    grunt.loadNpmTasks('grunt-curl');
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-bump');
    grunt.loadNpmTasks('grunt-surround');

    grunt.registerTask('default', [
        'less',
        'concat',
        'surround',
        'bump-only:prerelease'
    ]);

    grunt.registerTask('download', [
        'curl'
    ]);

    grunt.registerTask('release', function(type) {
        grunt.task.run('less');
        grunt.task.run('concat');
        grunt.task.run('surround');
        grunt.task.run('cssmin');
        grunt.task.run('uglify');
        grunt.task.run('bump-only:' + (type || 'patch'));
    });

};
