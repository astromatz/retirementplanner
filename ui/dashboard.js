export const createDashboard = (app) => ({
    render: (results) => {
        app.renderResults(results);
    },
    update: () => {
        app.initDashboard();
    }
});
