
module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.initConfig({
        'mochaTest': {
            'test': {
                'src': ['tests/*.js'],
                'options': {
                    'ignoreLeaks': true,
                    'reporter': 'spec'
                }
            }
        }
    });

    grunt.registerTask('default', 'mochaTest');
};
